/**
 * EmotionBadge Component
 * Displays a visual badge for the dominant emotion
 */

import React from 'react';
import type { EmotionLabel } from './types';
import { EMOTION_CONFIG } from './types';

export interface EmotionBadgeProps {
  emotion: EmotionLabel | string;
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function EmotionBadge({
  emotion,
  showIcon = true,
  showLabel = true,
  className = '',
}: EmotionBadgeProps) {
  const config = EMOTION_CONFIG[emotion as EmotionLabel] || EMOTION_CONFIG.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${className}`}
    >
      {showIcon && <span className="text-sm">{config.icon}</span>}
      {showLabel && <span className="capitalize">{config.label}</span>}
    </span>
  );
}
