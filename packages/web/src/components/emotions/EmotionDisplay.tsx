/**
 * EmotionDisplay Component
 * Main container that combines all emotion visualization components
 * Supports manual mood override and collapsible content
 */

import React from 'react';
import { useEmotionData } from '../../hooks/useEmotionData';
import { EmotionBadge } from './EmotionBadge';
import { EmotionTimeline } from './EmotionTimeline';
import { EmotionChart } from './EmotionChart';
import type { EmotionLabel } from './types';

export interface EmotionDisplayProps {
  journalId: string;
  duration: number;
  manualMood?: string | null;
  isExpanded?: boolean;
  retryButton?: React.ReactNode;
  className?: string;
}

export function EmotionDisplay({
  journalId,
  duration,
  manualMood,
  isExpanded = true,
  retryButton,
  className = ''
}: EmotionDisplayProps) {
  const { data, loading, error } = useEmotionData(journalId);

  // Show loading state
  if (loading) {
    return (
      <div className={`p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 ${className}`}>
        <p className="text-sm text-red-700 dark:text-red-300">Failed to load emotion data</p>
      </div>
    );
  }

  // Show processing status - check this BEFORE checking for data
  if (data?.processingStatus === 'processing' || data?.processingStatus === 'pending') {
    return (
      <div className={`p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 ${className}`}>
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-medium">Analyzing emotions...</span>
        </div>
      </div>
    );
  }

  // No data available - only show if we're not processing
  if (!data?.dominantEmotion) {
    return null;
  }

  // Mood priority logic: manual mood overrides detected emotion
  const primaryMood = (manualMood ?? data.dominantEmotion) as EmotionLabel;
  const hasManualMood = !!manualMood;
  const secondaryMood = hasManualMood ? (data.dominantEmotion as EmotionLabel) : null;

  // Ensure emotionTimeline and emotionScores are valid arrays/objects before passing to children
  const emotionTimeline = Array.isArray(data.emotionTimeline) ? data.emotionTimeline : [];
  const emotionScores = data.emotionScores && typeof data.emotionScores === 'object' ? data.emotionScores : {};

  return (
    <div className={`p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-4 ${className}`}>
      {/* Header with mood badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Detected Mood</h3>
        <div className="flex items-center gap-2">
          {/* Secondary badge (detected mood) - shown only when manual mood is set */}
          {hasManualMood && secondaryMood && (
            <>
              <EmotionBadge emotion={secondaryMood} className="px-2 py-0.5 text-[10px]" />
              <span className="text-xs text-gray-500 dark:text-gray-400">(Detected)</span>
            </>
          )}
          {/* Primary badge (manual mood if set, otherwise detected) */}
          <EmotionBadge emotion={primaryMood} />
          {hasManualMood && (
            <span className="text-xs text-gray-500 dark:text-gray-400">(Your Mood)</span>
          )}
        </div>
      </div>

      {/* Collapsible content: timeline, chart, and retry button */}
      {isExpanded && (
        <>
          {/* Timeline visualization */}
          {emotionTimeline.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Emotion Timeline</p>
              <EmotionTimeline timeline={emotionTimeline} duration={duration} />
            </div>
          )}

          {/* Emotion distribution chart */}
          {Object.keys(emotionScores).length > 0 && (
            <EmotionChart scores={emotionScores} />
          )}

          {/* Retry button at the bottom of collapsible content */}
          {retryButton && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              {retryButton}
            </div>
          )}
        </>
      )}
    </div>
  );
}
