/**
 * EmotionTimeline Component
 * Visualizes emotion changes throughout the video as a colored timeline
 */

import React from 'react';
import type { EmotionTimelineEntry, EmotionLabel } from './types';
import { TIMELINE_COLOR_MAP } from './types';

export interface EmotionTimelineProps {
  timeline: EmotionTimelineEntry[];
  duration: number;
  className?: string;
}

export function EmotionTimeline({ timeline, duration, className = '' }: EmotionTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  return (
    <div className={`relative w-full h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ${className}`}>
      {timeline.map((entry, i) => {
        const nextEntry = timeline[i + 1];
        const endTime = nextEntry ? nextEntry.time : duration;
        const width = ((endTime - entry.time) / duration) * 100;
        const left = (entry.time / duration) * 100;
        const color = TIMELINE_COLOR_MAP[entry.emotion as EmotionLabel] || TIMELINE_COLOR_MAP.neutral;

        return (
          <div
            key={i}
            className="absolute h-full transition-opacity hover:opacity-80 cursor-pointer"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: color,
            }}
            title={`${entry.emotion} at ${formatTime(entry.time)} (${Math.round(entry.confidence * 100)}% confidence)`}
          />
        );
      })}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
