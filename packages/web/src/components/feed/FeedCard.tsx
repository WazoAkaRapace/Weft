import type { FeedEntry } from '@weft/shared';
import { EmotionBadge } from '../emotions/EmotionBadge';
import { formatRelativeTime, formatDuration } from '../../lib/date-format';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface FeedCardProps {
  entry: FeedEntry;
  onClick: () => void;
}

export function FeedCard({ entry, onClick }: FeedCardProps) {
  if (entry.type === 'journal') {
    return (
      <div
        className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={onClick}
      >
        {/* Thumbnail */}
        <div className="w-30 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
          {entry.thumbnailPath ? (
            <img
              src={`${API_BASE}${entry.thumbnailPath.replace('/app', '')}`}
              alt={entry.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center" />
          )}
          <div className="absolute bottom-1 left-1 flex items-center gap-1.5">
            {entry.dominantEmotion && (
              <EmotionBadge emotion={entry.dominantEmotion} showLabel={false} className="text-xs px-1.5 py-0.5" />
            )}
            {entry.duration !== undefined && (
              <span className="bg-black/70 text-white px-1.5 py-0.5 rounded text-xs">
                {formatDuration(entry.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-medium text-text-default dark:text-text-dark-default m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
            {entry.title}
          </h4>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary m-0">
            {formatRelativeTime(entry.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Note entry
  return (
    <div
      className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      onClick={onClick}
    >
      {/* Icon */}
      <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
        {entry.icon || '📝'}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-medium text-text-default dark:text-text-dark-default m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {entry.title}
        </h4>
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary m-0">
          {formatRelativeTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}
