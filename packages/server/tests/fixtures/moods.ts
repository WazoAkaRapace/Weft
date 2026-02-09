/**
 * Mood Tracker Test Fixtures
 * Provides helper functions for mood-related test data
 */

import type { NewJournal } from '../../src/db/schema.js';
import { getTestDb } from '../setup.js';
import * as schema from '../../src/db/schema.js';

/**
 * Valid emotion values matching the EmotionLabel type
 */
export const VALID_EMOTIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'fear',
  'disgust',
  'surprise',
] as const;

export type EmotionLabel = typeof VALID_EMOTIONS[number];

/**
 * Emotion configuration matching frontend EMOTION_CONFIG
 */
export const EMOTION_ICONS: Record<EmotionLabel, string> = {
  neutral: '😐',
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fear: '😨',
  disgust: '🤢',
  surprise: '😮',
};

export const EMOTION_LABELS: Record<EmotionLabel, string> = {
  neutral: 'Neutral',
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  fear: 'Fear',
  disgust: 'Disgusted',
  surprise: 'Surprised',
};

/**
 * Create a journal entry with mood data
 */
export async function createJournalWithMood(
  userId: string,
  moodData: {
    manualMood?: EmotionLabel | null;
    dominantEmotion?: EmotionLabel | null;
    emotionTimeline?: Array<{ time: number; emotion: string; confidence: number }>;
    emotionScores?: Record<string, number>;
  } & Partial<NewJournal>
) {
  const db = getTestDb();

  const journalData: NewJournal = {
    id: moodData.id || crypto.randomUUID(),
    userId,
    title: moodData.title || 'Test Journal',
    videoPath: moodData.videoPath || '/uploads/test.webm',
    duration: moodData.duration || 60,
    thumbnailPath: moodData.thumbnailPath || null,
    location: moodData.location || null,
    notes: moodData.notes || null,
    manualMood: moodData.manualMood ?? null,
    dominantEmotion: moodData.dominantEmotion ?? null,
    emotionTimeline: moodData.emotionTimeline ?? null,
    emotionScores: moodData.emotionScores ?? null,
    hlsManifestPath: moodData.hlsManifestPath || null,
    hlsStatus: moodData.hlsStatus || null,
    hlsError: moodData.hlsError || null,
    hlsCreatedAt: moodData.hlsCreatedAt || null,
    createdAt: moodData.createdAt || new Date(),
    updatedAt: moodData.updatedAt || new Date(),
  };

  const journals = await db
    .insert(schema.journals)
    .values(journalData)
    .returning();

  return journals[0];
}

/**
 * Create multiple journals with different moods for a date range
 */
export async function createMoodCalendarData(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    count?: number;
    includeManualMoods?: boolean;
    includeDetectedEmotions?: boolean;
  } = {}
) {
  const {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    endDate = new Date(),
    count = 10,
    includeManualMoods = true,
    includeDetectedEmotions = true,
  } = options;

  const journals = [];

  for (let i = 0; i < count; i++) {
    const journalDate = new Date(startDate);
    journalDate.setTime(
      startDate.getTime() +
        Math.random() * (endDate.getTime() - startDate.getTime())
    );

    const hasManualMood = includeManualMoods && Math.random() > 0.5;
    const hasDetectedEmotion = includeDetectedEmotions && Math.random() > 0.3;

    const randomEmotion =
      VALID_EMOTIONS[Math.floor(Math.random() * VALID_EMOTIONS.length)];

    const journal = await createJournalWithMood(userId, {
      title: `Journal ${i + 1}`,
      createdAt: journalDate,
      manualMood: hasManualMood ? randomEmotion : null,
      dominantEmotion: hasDetectedEmotion ? randomEmotion : null,
      emotionTimeline: hasDetectedEmotion
        ? [{ time: 0, emotion: randomEmotion, confidence: 0.8 }]
        : undefined,
      emotionScores: hasDetectedEmotion
        ? { [randomEmotion]: 0.8, neutral: 0.2 }
        : undefined,
    });

    journals.push(journal);
  }

  return journals.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Create journals for testing calendar edge cases
 */
export async function createCalendarEdgeCases(userId: string) {
  const db = getTestDb();
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Day with manual mood only
  const manualOnly = await createJournalWithMood(userId, {
    title: 'Manual Only',
    createdAt: yesterday,
    manualMood: 'happy',
    dominantEmotion: null,
  });

  // Day with detected emotion only
  const detectedOnly = await createJournalWithMood(userId, {
    title: 'Detected Only',
    createdAt: today,
    manualMood: null,
    dominantEmotion: 'sad',
    emotionTimeline: [{ time: 0, emotion: 'sad', confidence: 0.85 }],
    emotionScores: { sad: 0.85, neutral: 0.15 },
  });

  // Day with both (manual overrides)
  const both = await createJournalWithMood(userId, {
    title: 'Both Moods',
    createdAt: tomorrow,
    manualMood: 'angry',
    dominantEmotion: 'fear',
    emotionTimeline: [{ time: 0, emotion: 'fear', confidence: 0.75 }],
    emotionScores: { fear: 0.75, neutral: 0.25 },
  });

  // Day with multiple entries
  const entry1 = await createJournalWithMood(userId, {
    title: 'Morning Entry',
    createdAt: new Date(today.setHours(8, 0, 0, 0)),
    manualMood: 'neutral',
  });

  const entry2 = await createJournalWithMood(userId, {
    title: 'Evening Entry',
    createdAt: new Date(today.setHours(20, 0, 0, 0)),
    dominantEmotion: 'happy',
    emotionTimeline: [{ time: 0, emotion: 'happy', confidence: 0.9 }],
    emotionScores: { happy: 0.9, neutral: 0.1 },
  });

  // Day with no mood data
  const noMood = await createJournalWithMood(userId, {
    title: 'No Mood',
    createdAt: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
    manualMood: null,
    dominantEmotion: null,
  });

  return {
    manualOnly,
    detectedOnly,
    both,
    multipleEntries: [entry1, entry2],
    noMood,
  };
}

/**
 * Generate emotion timeline data for testing
 */
export function generateEmotionTimeline(
  duration: number,
  primaryEmotion: EmotionLabel
): Array<{ time: number; emotion: string; confidence: number }> {
  const timeline: Array<{ time: number; emotion: string; confidence: number }> = [];
  const interval = 5; // 5 seconds per frame

  for (let time = 0; time < duration; time += interval) {
    timeline.push({
      time,
      emotion: primaryEmotion,
      confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
    });
  }

  return timeline;
}

/**
 * Generate emotion scores for testing
 */
export function generateEmotionScores(
  primaryEmotion: EmotionLabel
): Record<string, number> {
  const scores: Record<string, number> = {};

  VALID_EMOTIONS.forEach((emotion) => {
    if (emotion === primaryEmotion) {
      scores[emotion] = 0.6 + Math.random() * 0.3; // 0.6-0.9
    } else {
      scores[emotion] = Math.random() * 0.2; // 0-0.2
    }
  });

  return scores;
}
