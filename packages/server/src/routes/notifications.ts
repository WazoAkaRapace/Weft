/**
 * Notification API Routes
 *
 * Handles push notification subscription management and user preferences.
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { notificationPreferences } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  subscribeUser,
  unsubscribeUser,
  getUserSubscriptions,
  deleteSubscriptionById,
} from '../services/pushService.js';
import { getVapidPublicKey } from '../services/vapidService.js';
import { rescheduleUserNotifications } from '../services/notificationScheduler.js';
import { sendNotificationToUser } from '../services/pushService.js';
import {
  NOTIFICATION_TYPES,
  getNotificationTypesByCategory,
  isValidNotificationType,
} from '../services/notificationTypes.js';

/**
 * GET /api/notifications/vapid-public-key
 * Get VAPID public key for client subscription
 */
export async function handleGetVapidPublicKey(_request: Request): Promise<Response> {
  const publicKey = await getVapidPublicKey();

  if (!publicKey) {
    return Response.json({ error: 'VAPID not configured', code: 'VAPID_NOT_CONFIGURED' }, { status: 503 });
  }

  return Response.json({ publicKey });
}

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 */
export async function handleSubscribe(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as {
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      deviceName?: string;
    };

    if (!body.subscription?.endpoint || !body.subscription?.keys) {
      return Response.json(
        { error: 'Invalid subscription data', code: 'INVALID_SUBSCRIPTION' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    await subscribeUser(
      session.user.id,
      {
        endpoint: body.subscription.endpoint,
        keys: {
          p256dh: body.subscription.keys.p256dh,
          auth: body.subscription.keys.auth,
        },
      },
      userAgent,
      body.deviceName
    );

    // Initialize default preferences for new subscribers
    await initializeDefaultPreferences(session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Subscribe error:', error);
    return Response.json(
      { error: 'Failed to subscribe', code: 'SUBSCRIBE_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe from push notifications
 */
export async function handleUnsubscribe(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as { endpoint: string };

    if (!body.endpoint) {
      return Response.json({ error: 'Endpoint required', code: 'ENDPOINT_REQUIRED' }, { status: 400 });
    }

    await unsubscribeUser(body.endpoint);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Unsubscribe error:', error);
    return Response.json(
      { error: 'Failed to unsubscribe', code: 'UNSUBSCRIBE_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/subscriptions
 * Get user's active subscriptions
 */
export async function handleGetSubscriptions(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const subscriptions = await getUserSubscriptions(session.user.id);

    return Response.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        deviceName: sub.deviceName,
        userAgent: sub.userAgent,
        lastUsedAt: sub.lastUsedAt,
        createdAt: sub.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Notifications] Get subscriptions error:', error);
    return Response.json(
      { error: 'Failed to get subscriptions', code: 'GET_SUBSCRIPTIONS_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/subscriptions/:id
 * Remove a specific subscription
 */
export async function handleDeleteSubscription(
  request: Request,
  subscriptionId: string
): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const success = await deleteSubscriptionById(session.user.id, subscriptionId);

    if (!success) {
      return Response.json(
        { error: 'Subscription not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Delete subscription error:', error);
    return Response.json(
      { error: 'Failed to delete subscription', code: 'DELETE_SUBSCRIPTION_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function handleGetPreferences(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const preferences = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id));

    // Build result with all types, using user preferences or defaults
    const typesByCategory = getNotificationTypesByCategory();
    const result: Record<string, unknown[]> = {};

    for (const [category, types] of Object.entries(typesByCategory)) {
      result[category] = types.map((type) => {
        const userPref = preferences.find((p) => p.notificationType === type.id);
        return {
          ...type,
          enabled: userPref?.enabled ?? type.defaultEnabled,
          preferredTime: userPref?.preferredTime ?? type.defaultTime,
          preferredTimeSecondary: userPref?.preferredTimeSecondary ?? type.defaultTimeSecondary,
          timezone: userPref?.timezone ?? 'UTC',
          preferredDays: userPref?.preferredDays ?? type.defaultDays ?? [0, 1, 2, 3, 4, 5, 6],
        };
      });
    }

    return Response.json({ preferences: result });
  } catch (error) {
    console.error('[Notifications] Get preferences error:', error);
    return Response.json(
      { error: 'Failed to get preferences', code: 'GET_PREFERENCES_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences/:type
 * Update preference for a notification type
 */
export async function handleUpdatePreference(
  request: Request,
  notificationType: string
): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as {
      enabled?: boolean;
      preferredTime?: string;
      preferredTimeSecondary?: string;
      timezone?: string;
      preferredDays?: number[];
    };

    // Validate notification type
    if (!isValidNotificationType(notificationType)) {
      return Response.json(
        { error: 'Invalid notification type', code: 'INVALID_TYPE' },
        { status: 400 }
      );
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.preferredTime && !timeRegex.test(body.preferredTime)) {
      return Response.json(
        { error: 'Invalid time format. Use HH:mm', code: 'INVALID_TIME_FORMAT' },
        { status: 400 }
      );
    }
    if (body.preferredTimeSecondary && !timeRegex.test(body.preferredTimeSecondary)) {
      return Response.json(
        { error: 'Invalid secondary time format. Use HH:mm', code: 'INVALID_TIME_FORMAT' },
        { status: 400 }
      );
    }

    // Validate preferredDays if provided
    if (body.preferredDays !== undefined) {
      if (!Array.isArray(body.preferredDays) || body.preferredDays.length === 0) {
        return Response.json(
          { error: 'preferredDays must be a non-empty array', code: 'INVALID_DAYS' },
          { status: 400 }
        );
      }
      const validDays = body.preferredDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!validDays) {
        return Response.json(
          { error: 'preferredDays must contain integers 0-6 (Sunday-Saturday)', code: 'INVALID_DAYS' },
          { status: 400 }
        );
      }
    }

    // Upsert preference
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, session.user.id),
          eq(notificationPreferences.notificationType, notificationType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(notificationPreferences)
        .set({
          enabled: body.enabled ?? existing[0].enabled,
          preferredTime: body.preferredTime ?? existing[0].preferredTime,
          preferredTimeSecondary:
            body.preferredTimeSecondary ?? existing[0].preferredTimeSecondary,
          timezone: body.timezone ?? existing[0].timezone,
          preferredDays: body.preferredDays ?? existing[0].preferredDays,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.id, existing[0].id));
    } else {
      await db.insert(notificationPreferences).values({
        userId: session.user.id,
        notificationType,
        enabled: body.enabled ?? true,
        preferredTime: body.preferredTime,
        preferredTimeSecondary: body.preferredTimeSecondary,
        timezone: body.timezone,
        preferredDays: body.preferredDays ?? [0, 1, 2, 3, 4, 5, 6],
      });
    }

    // Reschedule notifications if time-based
    await rescheduleUserNotifications(session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Update preference error:', error);
    return Response.json(
      { error: 'Failed to update preference', code: 'UPDATE_PREFERENCE_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/types
 * Get all available notification types
 */
export async function handleGetNotificationTypes(_request: Request): Promise<Response> {
  return Response.json({
    types: NOTIFICATION_TYPES,
    categories: getNotificationTypesByCategory(),
  });
}

/**
 * POST /api/notifications/test
 * Send a test notification to the current user
 */
export async function handleSendTestNotification(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { title?: string; body?: string };

    const result = await sendNotificationToUser(session.user.id, 'test_notification', {
      title: body.title || 'Test Notification',
      body: body.body || 'This is a test notification from Weft!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test-notification',
      data: { url: '/', type: 'test' },
    });

    return Response.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('[Notifications] Test notification error:', error);
    return Response.json(
      { error: 'Failed to send test notification', code: 'TEST_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * Initialize default preferences for a new user
 */
async function initializeDefaultPreferences(userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (existing.length > 0) {
    return; // Already has preferences
  }

  // Create default preferences for all notification types
  const defaults = Object.values(NOTIFICATION_TYPES).map((type) => ({
    userId,
    notificationType: type.id,
    enabled: type.defaultEnabled,
    preferredTime: type.defaultTime,
    preferredTimeSecondary: type.defaultTimeSecondary,
    timezone: 'UTC',
    preferredDays: type.defaultDays ?? [0, 1, 2, 3, 4, 5, 6],
  }));

  await db.insert(notificationPreferences).values(defaults);
}
