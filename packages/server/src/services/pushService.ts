/**
 * Push Notification Service
 *
 * Handles push notification subscription management and sending notifications to users.
 */

import { getWebPush } from './vapidService.js';
import { db } from '../db/index.js';
import { pushSubscriptions, notificationHistory, notificationPreferences, dailyMoods } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { NotificationTypeId } from './notificationTypes.js';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Subscribe a user to push notifications
 */
export async function subscribeUser(
  userId: string,
  subscription: PushSubscriptionData,
  userAgent?: string,
  deviceName?: string
): Promise<void> {
  // Check if subscription already exists
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing.length > 0) {
    // Update existing subscription
    await db
      .update(pushSubscriptions)
      .set({
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent,
        deviceName,
        lastUsedAt: new Date(),
      })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
  } else {
    // Create new subscription
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dhKey: subscription.keys.p256dh,
      authKey: subscription.keys.auth,
      userAgent,
      deviceName,
    });
  }
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeUser(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

/**
 * Send notification to a specific subscription
 */
export async function sendNotification(
  subscription: { endpoint: string; p256dhKey: string; authKey: string },
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const webpush = getWebPush();
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dhKey,
          auth: subscription.authKey,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    console.error('[Push] Failed to send notification:', error);
    return false;
  }
}

/**
 * Send notification to all of a user's devices
 */
export async function sendNotificationToUser(
  userId: string,
  notificationType: NotificationTypeId,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await getUserSubscriptions(userId);
  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const success = await sendNotification(sub, payload);

    // Log to history
    await db.insert(notificationHistory).values({
      userId,
      subscriptionId: sub.id,
      notificationType,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: success ? 'sent' : 'failed',
    });

    if (success) {
      sent++;
      // Update last used
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } else {
      failed++;
      // Remove invalid subscription
      if (await isSubscriptionInvalid(sub.endpoint)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return { sent, failed };
}

/**
 * Check if user has notifications enabled for a type
 */
export async function isNotificationEnabled(
  userId: string,
  notificationType: NotificationTypeId
): Promise<boolean> {
  const pref = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType)
      )
    )
    .limit(1);

  return pref.length > 0 ? pref[0].enabled : true; // Default to enabled
}

/**
 * Get notification preference for a type
 */
export async function getNotificationPreference(
  userId: string,
  notificationType: NotificationTypeId
) {
  const pref = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType)
      )
    )
    .limit(1);

  return pref.length > 0 ? pref[0] : null;
}

/**
 * Check if user has already logged mood for the time period
 */
export async function hasMoodBeenLogged(
  userId: string,
  date: string,
  timeOfDay: 'morning' | 'afternoon'
): Promise<boolean> {
  const existingMood = await db
    .select()
    .from(dailyMoods)
    .where(
      and(
        eq(dailyMoods.userId, userId),
        eq(dailyMoods.date, date),
        eq(dailyMoods.timeOfDay, timeOfDay)
      )
    )
    .limit(1);

  return existingMood.length > 0;
}

/**
 * Check if subscription is invalid (410 Gone or 404 Not Found)
 */
async function isSubscriptionInvalid(endpoint: string): Promise<boolean> {
  // Web Push will return 410 Gone or 404 Not Found for invalid subscriptions
  // This is handled by the sendNotification error handling
  // For now, we'll mark as invalid if endpoint is empty or malformed
  return !endpoint || endpoint.length < 10;
}

/**
 * Delete a specific subscription by ID (for user to remove devices)
 */
export async function deleteSubscriptionById(
  userId: string,
  subscriptionId: string
): Promise<boolean> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId)
      )
    );

  return true;
}
