import type { EmotionData } from '@weft/shared';

export const mockEmotionData: EmotionData = {
  dominantEmotion: 'happy',
  emotionTimeline: [
    { timestamp: 0, emotion: 'neutral', score: 0.9 },
    { timestamp: 30, emotion: 'happy', score: 0.85 },
    { timestamp: 60, emotion: 'excited', score: 0.8 },
    { timestamp: 90, emotion: 'happy', score: 0.75 },
  ],
  emotionScores: {
    happy: 0.7,
    neutral: 0.15,
    sad: 0.05,
    excited: 0.1,
  },
  processingStatus: 'completed',
};

export const mockProcessingEmotionData: EmotionData = {
  ...mockEmotionData,
  processingStatus: 'processing',
};

export const mockPendingEmotionData: EmotionData = {
  ...mockEmotionData,
  processingStatus: 'pending',
};

export const mockFailedEmotionData: EmotionData = {
  ...mockEmotionData,
  processingStatus: 'failed',
  error: 'Failed to analyze emotions',
};
