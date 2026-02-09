/**
 * MoodLegend Component
 * Explains the color coding for moods and emotions
 */

import type { DailyMood } from './types';

interface LegendItem {
  mood: DailyMood;
  emoji: string;
  label: string;
  color: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  { mood: 'happy', emoji: '😊', label: 'Happy', color: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700' },
  { mood: 'sad', emoji: '😢', label: 'Sad', color: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700' },
  { mood: 'angry', emoji: '😠', label: 'Angry', color: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700' },
  { mood: 'neutral', emoji: '😐', label: 'Neutral', color: 'bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600' },
  { mood: 'sick', emoji: '🤒', label: 'Sick', color: 'bg-lime-100 dark:bg-lime-900/40 border-lime-300 dark:border-lime-700' },
  { mood: 'anxious', emoji: '😰', label: 'Anxious', color: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700' },
  { mood: 'tired', emoji: '😴', label: 'Tired', color: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700' },
  { mood: 'excited', emoji: '🤩', label: 'Excited', color: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700' },
  { mood: 'fear', emoji: '😨', label: 'Fear', color: 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700' },
  { mood: 'disgust', emoji: '🤢', label: 'Disgust', color: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' },
  { mood: 'surprise', emoji: '😮', label: 'Surprise', color: 'bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700' },
];

export function MoodLegend() {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-lg border border-neutral-200 dark:border-dark-600 p-4">
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-dark-300 mb-3">
        Mood Legend
      </h3>

      {/* Mood Colors */}
      <div className="space-y-3 mb-4">
        <p className="text-xs text-neutral-500 dark:text-dark-400 mb-2">Manual Mood:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.mood}
              className={`flex items-center gap-2 p-2 rounded border-2 ${item.color} transition-colors`}
            >
              <span className="text-lg" aria-label={item.label}>
                {item.emoji}
              </span>
              <span className="text-sm text-neutral-700 dark:text-dark-200">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend Explanations */}
      <div className="space-y-2 text-xs text-neutral-600 dark:text-dark-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-800 border border-neutral-400 dark:border-dark-500"></div>
          <span>Has journal entries</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full border-2 border-dashed border-neutral-300 dark:border-dark-600"></div>
          <span>Journal emotion only (no manual mood)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-dark-900"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
