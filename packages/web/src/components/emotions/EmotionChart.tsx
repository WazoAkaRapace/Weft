/**
 * EmotionChart Component
 * Displays a simple pie chart showing emotion distribution
 */

import React from 'react';
import type { EmotionLabel } from './types';
import { EMOTION_CONFIG } from './types';

export interface EmotionChartProps {
  scores: Record<string, number>;
  className?: string;
}

export function EmotionChart({ scores, className = '' }: EmotionChartProps) {
  if (!scores || Object.keys(scores).length === 0) {
    return null;
  }

  // Convert scores to array and sort by value
  const data = Object.entries(scores)
    .filter(([_, value]) => value > 0)
    .sort(([, a], [, b]) => b - a) as [EmotionLabel, number][];

  if (data.length === 0) {
    return null;
  }

  // Calculate cumulative percentages for pie slices
  let cumulativePercent = 0;
  const slices = data.map(([emotion, score]) => {
    const percent = score * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { emotion, score, percent, startPercent };
  });

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Emotion Distribution</h4>

      {/* Pie chart visualization using CSS conic-gradient */}
      <div className="flex items-center gap-4">
        <div
          className="relative w-24 h-24 rounded-full"
          style={{
            background: slices
              .map(
                ({ emotion, startPercent, percent }) =>
                  `${getPieColor(emotion)} ${startPercent}% ${startPercent + percent}%`
              )
              .join(', '),
          }}
          aria-label="Emotion distribution pie chart"
        />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {slices.map(({ emotion, score, percent }) => {
          const config = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;
          return (
            <div key={emotion} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getPieColor(emotion) }}
              />
              <span className="flex-1 text-gray-600 dark:text-gray-400">
                {config.icon} {config.label}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {Math.round(percent)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPieColor(emotion: EmotionLabel): string {
  const colors: Record<EmotionLabel, string> = {
    happy: '#facc15',
    sad: '#60a5fa',
    angry: '#f87171',
    fear: '#a78bfa',
    surprise: '#fb923c',
    disgust: '#4ade80',
    neutral: '#d1d5db',
  };
  return colors[emotion] || colors.neutral;
}
