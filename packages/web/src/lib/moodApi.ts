/**
 * Mood API Client
 * Handles API calls for daily mood tracking
 */

import type { DailyMood, MoodLogEntry, TimeOfDay } from '../components/calendar/types';
import { getApiUrl } from './config';

export interface MoodResponse {
  data: Array<{
    id: string;
    date: string;
    mood: DailyMood | null;
    timeOfDay: TimeOfDay;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }> | null;
  error: string | null;
  code: string;
}

export interface MoodsResponse {
  data: {
    moods: Array<{
      date: string;
      mood: DailyMood | null;
      notes: string | null;
    }>;
  } | null;
  error: string | null;
  code: string;
}

export interface CalendarMoodsResponse {
  data: {
    year: number;
    month: number;
    moods: Record<
      string,
      {
        morningMood: DailyMood | null;
        afternoonMood: DailyMood | null;
        morningNotes: string | null;
        afternoonNotes: string | null;
        hasJournal: boolean;
        journalEmotions?: string[];
      }
    >;
  } | null;
  error: string | null;
  code: string;
}

/**
 * Get mood data for a calendar month
 */
export async function getCalendarMoods(
  year: number,
  month: number
): Promise<CalendarMoodsResponse> {
  const response = await fetch(
    `${getApiUrl()}/api/moods/calendar?year=${year}&month=${month}`,
    {
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar moods: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get mood for a specific date
 */
export async function getMood(date: string): Promise<MoodResponse> {
  const response = await fetch(`${getApiUrl()}/api/moods/${date}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch mood: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create or update mood for a date
 */
export async function upsertMood(entry: MoodLogEntry): Promise<MoodResponse> {
  const response = await fetch(`${API_BASE}/api/moods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(`Failed to save mood: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete mood for a date
 */
export async function deleteMood(date: string, timeOfDay: TimeOfDay): Promise<{ success: boolean; error: string | null }> {
  const response = await fetch(`${getApiUrl()}/api/moods/${date}?timeOfDay=${timeOfDay}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete mood: ${response.statusText}`);
  }

  return response.json();
}
