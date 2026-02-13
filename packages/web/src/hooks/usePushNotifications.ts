/**
 * Push Notifications Hook
 *
 * React hook for managing Web Push subscriptions and notification preferences.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PushSubscriptionData {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
}

interface NotificationTypeConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  supportsTime: boolean;
  supportsSecondaryTime: boolean;
  enabled: boolean;
  preferredTime?: string;
  preferredTimeSecondary?: string;
  timezone?: string;
  preferredDays?: number[];
  category: string;
  defaultTime?: string;
  defaultDays?: number[];
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  vapidPublicKey: string | null;
  subscriptions: PushSubscriptionData[];
  preferences: Record<string, NotificationTypeConfig[]>;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  subscribe: (deviceName?: string) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  deleteSubscription: (id: string) => Promise<boolean>;
  updatePreference: (type: string, settings: Partial<NotificationTypeConfig>) => Promise<boolean>;
  refreshSubscriptions: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionData[]>([]);
  const [preferences, setPreferences] = useState<Record<string, NotificationTypeConfig[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  // Use lazy initializer to get initial permission state
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (isSupported) {
      return Notification.permission;
    }
    return 'default';
  });

  const isSubscribed = subscriptions.length > 0;

  // Fetch VAPID public key
  const fetchVapidKey = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/vapid-public-key`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setVapidPublicKey(data.publicKey);
      }
    } catch {
      // Silently fail - notifications are optional
    }
  }, []);

  // Fetch subscriptions
  const refreshSubscriptions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/subscriptions`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions);
      }
    } catch {
      // Silently fail - subscriptions will be empty
    }
  }, []);

  // Fetch preferences
  const refreshPreferences = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications/preferences`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch {
      // Silently fail - preferences will be empty
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchVapidKey(), refreshSubscriptions(), refreshPreferences()]);
      setIsLoading(false);
    };
    init();
  }, [fetchVapidKey, refreshSubscriptions, refreshPreferences]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, [isSupported]);

  // Subscribe
  const subscribe = useCallback(
    async (deviceName?: string): Promise<boolean> => {
      if (!isSupported || !vapidPublicKey) return false;

      try {
        const registration = await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const response = await fetch(`${API_BASE}/api/notifications/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceName: deviceName || getDeviceName(),
          }),
        });

        if (response.ok) {
          await refreshSubscriptions();
          await refreshPreferences();
          return true;
        }
        return false;
      } catch {
        setError('Failed to subscribe to notifications');
        return false;
      }
    },
    [isSupported, vapidPublicKey, refreshSubscriptions, refreshPreferences]
  );

  // Unsubscribe current device
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch(`${API_BASE}/api/notifications/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      await refreshSubscriptions();
      return true;
    } catch {
      setError('Failed to unsubscribe');
      return false;
    }
  }, [refreshSubscriptions]);

  // Delete specific subscription
  const deleteSubscription = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/api/notifications/subscriptions/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (response.ok) {
          await refreshSubscriptions();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [refreshSubscriptions]
  );

  // Update preference
  const updatePreference = useCallback(
    async (type: string, settings: Partial<NotificationTypeConfig>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/api/notifications/preferences/${type}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(settings),
        });

        if (response.ok) {
          await refreshPreferences();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [refreshPreferences]
  );

  return {
    isSupported,
    isSubscribed,
    permission,
    vapidPublicKey,
    subscriptions,
    preferences,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    deleteSubscription,
    updatePreference,
    refreshSubscriptions,
    refreshPreferences,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android Device';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown Device';
}
