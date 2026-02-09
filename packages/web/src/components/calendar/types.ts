/**
 * Calendar component types
 */

import type { EmotionLabel } from '../emotions/types';

export type DailyMood = 'happy' | 'sad' | 'angry' | 'neutral' | 'sick' | 'anxious' | 'tired' | 'excited' | 'fear' | 'disgust' | 'surprise';

export type TimeOfDay = 'morning' | 'afternoon';

export interface DayData {
  date: Date;
  morningMood: DailyMood | null;
  afternoonMood: DailyMood | null;
  morningNotes: string | null;
  afternoonNotes: string | null;
  journalEmotions: EmotionLabel[];
  hasJournalEntries: boolean;
}

export interface CalendarMonthData {
  year: number;
  month: number; // 0-11 (January = 0)
  days: Map<string, DayData>; // key: 'YYYY-MM-DD'
}

export interface MoodLogEntry {
  date: string; // YYYY-MM-DD format
  mood: DailyMood | null;
  timeOfDay: TimeOfDay;
  notes?: string | null;
}

export interface CalendarViewProps {
  currentDate: Date;
  onDateClick: (date: Date, timeOfDay?: TimeOfDay) => void;
  onMonthChange: (date: Date) => void;
  monthData: CalendarMonthData | null;
  isLoading?: boolean;
}

export interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  data?: DayData;
  onClick: (timeOfDay: TimeOfDay) => void;
  isDisabled?: boolean;
}
