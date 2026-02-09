/**
 * MoodPromptCard Component
 * Shows a prompt to log mood when it hasn't been logged yet for the current time period
 */

import type { TimeOfDay } from '@weft/shared';

interface MoodPromptCardProps {
  timeOfDay: TimeOfDay;
  onClick: () => void;
}

export function MoodPromptCard({ timeOfDay, onClick }: MoodPromptCardProps) {
  const getTitle = () => {
    return timeOfDay === 'morning' ? "Good morning! ☀️" : "Good afternoon! 🌤️";
  };

  const getMessage = () => {
    return timeOfDay === 'morning'
      ? "How are you feeling this morning?"
      : "How are you feeling this afternoon?";
  };

  const getButtonText = () => {
    return timeOfDay === 'morning' ? "Log Morning Mood" : "Log Afternoon Mood";
  };

  return (
    <div
      className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-6 mb-6 border-2 border-yellow-200 dark:border-yellow-700/50 cursor-pointer hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-1">
            {getTitle()}
          </h3>
          <p className="text-neutral-600 dark:text-dark-400">
            {getMessage()}
          </p>
        </div>
        <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors">
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}
