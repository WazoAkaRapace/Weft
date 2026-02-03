/**
 * Emotion detection types
 */

export type EmotionLabel = 'neutral' | 'happy' | 'sad' | 'angry' | 'fear' | 'disgust' | 'surprise';

export interface EmotionTimelineEntry {
  time: number;      // Timestamp in seconds
  emotion: string;   // Emotion label
  confidence: number; // 0-1 confidence score
}

export interface EmotionData {
  dominantEmotion?: string | null;
  emotionTimeline?: EmotionTimelineEntry[] | null;
  emotionScores?: Record<string, number> | null;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
}

export const EMOTION_CONFIG: Record<EmotionLabel, { icon: string; color: string; label: string }> = {
  happy: { icon: '😊', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Happy' },
  sad: { icon: '😢', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Sad' },
  angry: { icon: '😠', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Angry' },
  fear: { icon: '😨', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Fear' },
  surprise: { icon: '😮', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Surprised' },
  disgust: { icon: '🤢', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Disgusted' },
  neutral: { icon: '😐', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', label: 'Neutral' },
};

export const TIMELINE_COLOR_MAP: Record<EmotionLabel, string> = {
  happy: 'rgb(253, 230, 138)',
  sad: 'rgb(191, 219, 254)',
  angry: 'rgb(254, 202, 202)',
  fear: 'rgb(233, 213, 255)',
  surprise: 'rgb(253, 186, 139)',
  disgust: 'rgb(187, 247, 208)',
  neutral: 'rgb(243, 244, 246)',
};
