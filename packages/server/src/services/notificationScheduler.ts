/**
 * Notification Scheduler Service
 *
 * Handles scheduling and sending of time-based notifications like mood reminders.
 * Uses in-memory scheduling (for single-instance deployments).
 */

import { db } from '../db/index.js';
import { notificationPreferences, pushSubscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  sendNotificationToUser,
  isNotificationEnabled,
  hasMoodBeenLogged,
} from './pushService.js';
import { NOTIFICATION_TYPES, getTimeBasedNotificationTypes } from './notificationTypes.js';
import type { NotificationTypeId } from './notificationTypes.js';

// Store scheduled jobs in memory (for single-instance deployment)
const scheduledJobs = new Map<string, NodeJS.Timeout>();

/**
 * Calculate the next occurrence of a scheduled notification
 * Takes into account the preferred days of the week
 */
function calculateNextOccurrence(
  now: Date,
  hours: number,
  minutes: number,
  preferredDays: number[]
): Date {
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);

  // Get current day of week (0=Sunday, 6=Saturday)
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const scheduledTime = hours * 60 + minutes;

  // Find the next preferred day
  // If today is a preferred day and time hasn't passed, use today
  if (preferredDays.includes(currentDay) && scheduledTime > currentTime) {
    return scheduled;
  }

  // Find the next preferred day
  let daysToAdd = 1;
  let checkDay = (currentDay + 1) % 7;

  while (!preferredDays.includes(checkDay) && daysToAdd <= 7) {
    daysToAdd++;
    checkDay = (checkDay + 1) % 7;
  }

  scheduled.setDate(scheduled.getDate() + daysToAdd);
  return scheduled;
}

/**
 * Initialize the notification scheduler
 * Should be called on server startup
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing notification scheduler...');

  // Get all users with enabled time-based notifications
  const timeBasedTypes = getTimeBasedNotificationTypes();

  for (const type of timeBasedTypes) {
    // Get all users who have this notification type enabled
    const preferences = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.notificationType, type.id),
          eq(notificationPreferences.enabled, true)
        )
      );

    for (const pref of preferences) {
      await scheduleNotificationForUser(pref.userId, type.id, {
        preferredTime: pref.preferredTime,
        timezone: pref.timezone,
        preferredDays: pref.preferredDays || type.defaultDays,
      });
    }
  }

  console.log(`[Scheduler] Scheduled ${scheduledJobs.size} notification jobs`);
}

/**
 * Schedule a notification for a user
 */
async function scheduleNotificationForUser(
  userId: string,
  notificationType: NotificationTypeId,
  preference?: {
    preferredTime?: string | null;
    timezone?: string | null;
    preferredDays?: number[];
  }
): Promise<void> {
  const jobKey = `${userId}:${notificationType}`;

  // Cancel existing job if any
  const existingJob = scheduledJobs.get(jobKey);
  if (existingJob) {
    clearTimeout(existingJob);
    scheduledJobs.delete(jobKey);
  }

  const typeConfig = NOTIFICATION_TYPES[notificationType];
  if (!typeConfig || !typeConfig.supportsTime) {
    return;
  }

  // Parse the time
  const timeStr = preference?.preferredTime || typeConfig.defaultTime || '12:00';
  const [hours, minutes] = timeStr.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    console.warn(`[Scheduler] Invalid time format for ${notificationType}: ${timeStr}`);
    return;
  }

  // Get preferred days (default to all days)
  const preferredDays = preference?.preferredDays || typeConfig.defaultDays || [0, 1, 2, 3, 4, 5, 6];

  // Validate preferred days
  if (preferredDays.length === 0) {
    console.warn(`[Scheduler] No preferred days for ${notificationType}, user ${userId}`);
    return;
  }

  // Calculate next occurrence using the new function
  const now = new Date();
  const scheduled = calculateNextOccurrence(now, hours, minutes, preferredDays);

  const delay = scheduled.getTime() - now.getTime();

  console.log(
    `[Scheduler] Scheduling ${notificationType} for user ${userId} at ${scheduled.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`
  );

  const timeout = setTimeout(async () => {
    await sendScheduledNotification(userId, notificationType);
    // Reschedule for next occurrence
    await scheduleNotificationForUser(userId, notificationType, preference);
  }, delay);

  scheduledJobs.set(jobKey, timeout);
}

/**
 * Send scheduled notification
 */
async function sendScheduledNotification(
  userId: string,
  notificationType: NotificationTypeId
): Promise<void> {
  console.log(`[Scheduler] Sending ${notificationType} to user ${userId}`);

  // Check if user has any subscriptions
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    console.log(`[Scheduler] User ${userId} has no push subscriptions`);
    return;
  }

  // Check if notification is still enabled
  const enabled = await isNotificationEnabled(userId, notificationType);
  if (!enabled) {
    console.log(`[Scheduler] ${notificationType} is disabled for user ${userId}`);
    return;
  }

  // For mood reminders, check if mood already logged
  if (notificationType === 'mood_reminder_morning' || notificationType === 'mood_reminder_afternoon') {
    const timeOfDay = notificationType === 'mood_reminder_morning' ? 'morning' : 'afternoon';
    const today = new Date().toISOString().split('T')[0];

    const alreadyLogged = await hasMoodBeenLogged(userId, today, timeOfDay);
    if (alreadyLogged) {
      console.log(`[Scheduler] User ${userId} already logged ${timeOfDay} mood`);
      return;
    }
  }

  // Build notification payload
  const typeConfig = NOTIFICATION_TYPES[notificationType];
  const payload = buildNotificationPayload(notificationType, typeConfig);

  // Send notification
  const result = await sendNotificationToUser(userId, notificationType, payload);

  console.log(
    `[Scheduler] Sent ${notificationType} to user ${userId}: ${result.sent} sent, ${result.failed} failed`
  );
}

/**
 * Build notification payload based on type
 */
function buildNotificationPayload(
  notificationType: NotificationTypeId,
  typeConfig: typeof NOTIFICATION_TYPES[NotificationTypeId]
) {
  const basePayload = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
  };

  switch (notificationType) {
    case 'mood_reminder_morning':
      return {
        ...basePayload,
        title: 'Good morning! 🌅',
        body: 'Time to log your morning mood. How are you feeling?',
        tag: 'mood-morning',
        data: { url: '/mood-calendar', type: notificationType },
        actions: [
          { action: 'log', title: 'Log Mood' },
          { action: 'dismiss', title: 'Later' },
        ],
      };

    case 'mood_reminder_afternoon':
      return {
        ...basePayload,
        title: 'Afternoon check-in 🌇',
        body: "How's your day going? Time to log your afternoon mood.",
        tag: 'mood-afternoon',
        data: { url: '/mood-calendar', type: notificationType },
        actions: [
          { action: 'log', title: 'Log Mood' },
          { action: 'dismiss', title: 'Later' },
        ],
      };

    case 'journal_reminder':
      return {
        ...basePayload,
        title: 'Journal reminder 📔',
        body: "It's time for your journal entry. What happened today?",
        tag: 'journal-reminder',
        data: { url: '/record', type: notificationType },
        actions: [
          { action: 'record', title: 'Record' },
          { action: 'dismiss', title: 'Later' },
        ],
      };

    default:
      return {
        ...basePayload,
        title: typeConfig.name,
        body: typeConfig.description,
        tag: notificationType,
        data: { type: notificationType },
      };
  }
}

/**
 * Reschedule all notifications for a user
 */
export async function rescheduleUserNotifications(userId: string): Promise<void> {
  const timeBasedTypes = getTimeBasedNotificationTypes();

  for (const type of timeBasedTypes) {
    const preference = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.notificationType, type.id)
        )
      )
      .limit(1);

    if (preference.length > 0 && preference[0].enabled) {
      await scheduleNotificationForUser(userId, type.id, {
        preferredTime: preference[0].preferredTime,
        timezone: preference[0].timezone,
        preferredDays: preference[0].preferredDays || type.defaultDays,
      });
    } else {
      // Cancel if disabled or no preference
      const jobKey = `${userId}:${type.id}`;
      const existingJob = scheduledJobs.get(jobKey);
      if (existingJob) {
        clearTimeout(existingJob);
        scheduledJobs.delete(jobKey);
      }
    }
  }
}

/**
 * Stop scheduler (for graceful shutdown)
 */
export function stopScheduler(): void {
  console.log('[Scheduler] Stopping notification scheduler...');
  for (const [_key, timeout] of scheduledJobs) {
    clearTimeout(timeout);
  }
  scheduledJobs.clear();
  console.log('[Scheduler] Stopped');
}
