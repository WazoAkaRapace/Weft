/**
 * Notification Types Registry
 *
 * Central definition of all notification types supported by the system.
 * Each type has configuration for display, timing, and default behavior.
 */

export type NotificationTypeId =
  | 'mood_reminder_morning'
  | 'mood_reminder_afternoon'
  | 'journal_reminder'
  | 'backup_complete'
  | 'backup_failed'
  | 'transcription_complete'
  | 'emotion_analysis_complete'
  | 'test_notification';

export type NotificationCategory = 'reminder' | 'system' | 'activity';

export interface NotificationTypeConfig {
  id: NotificationTypeId;
  name: string;
  description: string;
  icon: string;
  supportsTime: boolean;
  supportsSecondaryTime: boolean;
  defaultEnabled: boolean;
  defaultTime?: string;
  defaultTimeSecondary?: string;
  defaultDays?: number[]; // 0=Sunday, 6=Saturday
  category: NotificationCategory;
}

/**
 * All supported notification types with their configurations
 */
export const NOTIFICATION_TYPES: Record<NotificationTypeId, NotificationTypeConfig> = {
  mood_reminder_morning: {
    id: 'mood_reminder_morning',
    name: 'Morning Mood Reminder',
    description: 'Daily reminder to log your morning mood',
    icon: '🌅',
    supportsTime: true,
    supportsSecondaryTime: false,
    defaultEnabled: true,
    defaultTime: '11:00',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    category: 'reminder',
  },
  mood_reminder_afternoon: {
    id: 'mood_reminder_afternoon',
    name: 'Afternoon Mood Reminder',
    description: 'Daily reminder to log your afternoon mood',
    icon: '🌇',
    supportsTime: true,
    supportsSecondaryTime: false,
    defaultEnabled: true,
    defaultTime: '18:00',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    category: 'reminder',
  },
  journal_reminder: {
    id: 'journal_reminder',
    name: 'Journal Reminder',
    description: 'Reminder to create a journal entry',
    icon: '📔',
    supportsTime: true,
    supportsSecondaryTime: false,
    defaultEnabled: false,
    defaultTime: '20:00',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    category: 'reminder',
  },
  backup_complete: {
    id: 'backup_complete',
    name: 'Backup Complete',
    description: 'Notification when a backup finishes successfully',
    icon: '✅',
    supportsTime: false,
    supportsSecondaryTime: false,
    defaultEnabled: true,
    category: 'system',
  },
  backup_failed: {
    id: 'backup_failed',
    name: 'Backup Failed',
    description: 'Alert when a backup operation fails',
    icon: '⚠️',
    supportsTime: false,
    supportsSecondaryTime: false,
    defaultEnabled: true,
    category: 'system',
  },
  transcription_complete: {
    id: 'transcription_complete',
    name: 'Transcription Complete',
    description: 'Notification when video transcription finishes',
    icon: '📝',
    supportsTime: false,
    supportsSecondaryTime: false,
    defaultEnabled: false,
    category: 'activity',
  },
  emotion_analysis_complete: {
    id: 'emotion_analysis_complete',
    name: 'Emotion Analysis Complete',
    description: 'Notification when emotion detection finishes',
    icon: '😊',
    supportsTime: false,
    supportsSecondaryTime: false,
    defaultEnabled: false,
    category: 'activity',
  },
  test_notification: {
    id: 'test_notification',
    name: 'Test Notification',
    description: 'Test notification for debugging',
    icon: '🔔',
    supportsTime: false,
    supportsSecondaryTime: false,
    defaultEnabled: false,
    category: 'system',
  },
};

/**
 * Get notification types grouped by category
 */
export function getNotificationTypesByCategory(): Record<NotificationCategory, NotificationTypeConfig[]> {
  return Object.values(NOTIFICATION_TYPES).reduce(
    (acc, type) => {
      if (!acc[type.category]) {
        acc[type.category] = [];
      }
      acc[type.category].push(type);
      return acc;
    },
    {} as Record<NotificationCategory, NotificationTypeConfig[]>
  );
}

/**
 * Check if a notification type is valid
 */
export function isValidNotificationType(type: string): type is NotificationTypeId {
  return type in NOTIFICATION_TYPES;
}

/**
 * Get all time-based notification types (those that support scheduling)
 */
export function getTimeBasedNotificationTypes(): NotificationTypeConfig[] {
  return Object.values(NOTIFICATION_TYPES).filter((type) => type.supportsTime);
}
