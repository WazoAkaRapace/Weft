import type { FeedEntry } from '@weft/shared';
import { EmotionBadge } from '../emotions/EmotionBadge';
import { formatRelativeTime, formatDuration } from '../../lib/date-format';
import { getApiUrl } from '../../lib/config';

interface FeedCardProps {
  entry: FeedEntry;
  onClick: () => void;
}

export function FeedCard({ entry, onClick }: FeedCardProps) {
  if (entry.type === 'journal') {
    return (
      <div
        className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-dark-700"
        onClick={onClick}
      >
        {/* Thumbnail */}
        <div className="w-30 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
          {entry.thumbnailPath ? (
            <img
              src={`${getApiUrl()}${entry.thumbnailPath.replace('/app', '')}`}
              alt={entry.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center" />
          )}
          <div className="absolute bottom-1 left-1 flex items-center gap-1.5">
            {(entry.manualMood ?? entry.dominantEmotion) && (
              <EmotionBadge emotion={entry.manualMood ?? entry.dominantEmotion} showLabel={false} className="text-xs px-1.5 py-0.5" />
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
          <h4 className="text-base font-medium text-neutral-900 dark:text-dark-50 m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
            {entry.title}
          </h4>
          <p className="text-sm text-neutral-500 dark:text-dark-400 m-0">
            {formatRelativeTime(entry.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Note entry
  return (
    <div
      className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-dark-700"
      onClick={onClick}
    >
      {/* Icon */}
      <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-neutral-100 dark:bg-dark-700 flex items-center justify-center text-2xl">
        {entry.icon || '📝'}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-medium text-neutral-900 dark:text-dark-50 m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {entry.title}
        </h4>
        <p className="text-sm text-neutral-500 dark:text-dark-400 m-0">
          {formatRelativeTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}
