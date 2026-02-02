import type { FeedEntry } from '@weft/shared';
import { FeedCard } from './FeedCard';
import { EmptyFeedState } from './EmptyFeedState';
import { formatDate } from '../../lib/date-format';

interface FeedListProps {
  entries: FeedEntry[];
  isLoading: boolean;
  hasNotes: boolean;
  hasJournals: boolean;
  onEntryClick: (entry: FeedEntry) => void;
}

// Loading skeleton component
function FeedCardSkeleton() {
  return (
    <div className="flex gap-4 p-4 rounded-lg animate-pulse">
      <div className="w-30 h-20 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 min-w-0">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    </div>
  );
}

export function FeedList({ entries, isLoading, hasNotes, hasJournals, onEntryClick }: FeedListProps) {
  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, FeedEntry[]>);

  // Sort dates descending (newest first)
  const dates = Object.keys(groupedEntries).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      </div>
    );
  }

  // Show empty state
  if (entries.length === 0) {
    return <EmptyFeedState hasNotes={hasNotes} hasJournals={hasJournals} />;
  }

  // Show grouped entries
  return (
    <div className="flex flex-col gap-8">
      {dates.map((date) => (
        <div key={date} className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-border-light dark:border-gray-700">
            <h3 className="text-xl text-text-default dark:text-text-dark-default m-0">
              {formatDate(date)}
            </h3>
            <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
              {groupedEntries[date].length} {groupedEntries[date].length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="grid gap-4">
            {groupedEntries[date].map((entry) => (
              <FeedCard key={entry.id} entry={entry} onClick={() => onEntryClick(entry)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
