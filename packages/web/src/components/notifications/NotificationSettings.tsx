/**
 * Notification Settings Component
 *
 * Provides UI for managing push notification subscriptions and preferences.
 */

import { useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { DayOfWeekSelector } from './DayOfWeekSelector';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Convert local time string (HH:mm) to UTC time string
 * Used when saving notification times to the backend
 */
function localTimeToUTC(localTime: string): string {
  const [hours, minutes] = localTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
}

/**
 * Convert UTC time string (HH:mm) to local time string
 * Used when displaying notification times from the backend
 */
function utcToLocalTime(utcTime: string): string {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    subscriptions,
    preferences,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    deleteSubscription,
    updatePreference,
  } = usePushNotifications();

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});
  const [dayInputs, setDayInputs] = useState<Record<string, number[]>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestNotification = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE}/api/notifications/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Notification', body: 'If you see this, notifications are working!' }),
      });
      const data = await response.json();
      if (data.success && data.sent > 0) {
        setTestResult({ success: true, message: `Notification sent! Check your device.` });
      } else if (data.failed > 0) {
        setTestResult({ success: false, message: 'Failed to send notification. Try re-enabling notifications.' });
      } else {
        setTestResult({ success: false, message: 'No devices subscribed. Enable notifications first.' });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to send test notification.' });
    }
    setIsTesting(false);
  };

  if (!isSupported) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-amber-800 dark:text-amber-200 text-sm">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true);

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setIsSubscribing(false);
        return;
      }
    }

    await subscribe();
    setIsSubscribing(false);
  };

  const handleTimeChange = (type: string, time: string) => {
    setTimeInputs((prev) => ({ ...prev, [type]: time }));
  };

  const handleDaysChange = (type: string, days: number[]) => {
    setDayInputs((prev) => ({ ...prev, [type]: days }));
  };

  const handleSaveSchedule = async (type: string, originalTime: string | undefined, originalDays: number[] | undefined) => {
    const time = timeInputs[type] || originalTime;
    const days = dayInputs[type] || originalDays || [0, 1, 2, 3, 4, 5, 6];
    // Convert local time to UTC before sending to backend
    const utcTime = localTimeToUTC(time);
    await updatePreference(type, { preferredTime: utcTime, preferredDays: days });
    // Clear the local input state so the display uses the refreshed data from backend
    setTimeInputs((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setDayInputs((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const hasScheduleChanges = (type: string, originalTime: string | undefined, originalDays: number[] | undefined) => {
    // Convert original UTC time to local for comparison with the input
    const localOriginalTime = originalTime ? utcToLocalTime(originalTime) : undefined;
    const timeChanged = timeInputs[type] && timeInputs[type] !== localOriginalTime;
    const daysChanged = dayInputs[type] && JSON.stringify([...dayInputs[type]].sort()) !== JSON.stringify([...(originalDays || [0,1,2,3,4,5,6])].sort());
    return timeChanged || daysChanged;
  };

  const handleToggle = async (type: string, enabled: boolean) => {
    await updatePreference(type, { enabled });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Subscription Status */}
      <section>
        <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">
          Push Notifications
        </h4>

        {isLoading ? (
          <p className="text-neutral-500 text-sm">Loading...</p>
        ) : isSubscribed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">Notifications enabled</span>
            </div>

            {/* Device list */}
            {subscriptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                  Connected Devices
                </p>
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {sub.deviceName || 'Unknown Device'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Last used: {new Date(sub.lastUsedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteSubscription(sub.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={unsubscribe}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              Disable on this device
            </button>

            {/* Test notification button */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestNotification}
                  disabled={isTesting}
                  className="px-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isTesting ? 'Sending...' : 'Send Test Notification'}
                </button>
                {testResult && (
                  <span className={`text-sm ${testResult.success ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Enable push notifications to receive mood reminders and other updates.
            </p>
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
            </button>
          </div>
        )}
      </section>

      {/* Notification Preferences */}
      {isSubscribed && Object.keys(preferences).length > 0 && (
        <section className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-4">
            Notification Preferences
          </h4>

          <div className="space-y-6">
            {Object.entries(preferences).map(([category, types]) => (
              <div key={category}>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
                  {category}
                </p>
                <div className="space-y-3">
                  {types.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-start justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{type.icon}</span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">
                            {type.name}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          {type.description}
                        </p>

                        {/* Time picker for time-based notifications */}
                        {type.supportsTime && type.enabled && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-neutral-600 dark:text-neutral-400">
                                Reminder time:
                              </label>
                              <input
                                type="time"
                                value={timeInputs[type.id] || (type.preferredTime ? utcToLocalTime(type.preferredTime) : '12:00')}
                                onChange={(e) => handleTimeChange(type.id, e.target.value)}
                                className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                              />
                            </div>

                            {/* Day of week selector */}
                            <div>
                              <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-2">
                                Active days:
                              </label>
                              <DayOfWeekSelector
                                value={dayInputs[type.id] || type.preferredDays || [0, 1, 2, 3, 4, 5, 6]}
                                onChange={(days) => handleDaysChange(type.id, days)}
                              />
                            </div>

                            {/* Single save button for both time and days */}
                            {hasScheduleChanges(type.id, type.preferredTime, type.preferredDays) && (
                              <button
                                onClick={() => handleSaveSchedule(type.id, type.preferredTime, type.preferredDays)}
                                className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                              >
                                Save Changes
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Toggle switch */}
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={type.enabled}
                          onChange={(e) => handleToggle(type.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Troubleshooting Tips */}
      {isSubscribed && (
        <section className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white list-none flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Notifications not working?
            </summary>
            <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                If you sent a test notification but didn't receive it, check these settings:
              </p>
              <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 mt-0.5">1.</span>
                  <span>
                    <strong>Browser permissions:</strong> Go to your browser's site settings and ensure notifications are allowed for this site.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 mt-0.5">2.</span>
                  <span>
                    <strong>System notifications:</strong> On macOS, go to System Settings → Notifications and ensure your browser is allowed to send notifications.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 mt-0.5">3.</span>
                  <span>
                    <strong>Focus/Do Not Disturb:</strong> Make sure Focus mode or Do Not Disturb is not enabled on your device.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 mt-0.5">4.</span>
                  <span>
                    <strong>HTTPS required:</strong> Push notifications only work on HTTPS or localhost. Make sure you're accessing via <code className="px-1 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs">http://localhost:3000</code> (not 127.0.0.1).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 mt-0.5">5.</span>
                  <span>
                    <strong>Browser must be running:</strong> On desktop, the browser needs to be open (background is fine) to receive push notifications.
                  </span>
                </li>
              </ul>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
