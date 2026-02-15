import type { FeedEntry, DailyMood } from '@weft/shared';
import { FeedCard } from './FeedCard';
import { EmptyFeedState } from './EmptyFeedState';
import { formatDate } from '../../lib/date-format';
import { format } from 'date-fns';
import { useMemo } from 'react';

interface FeedListProps {
  entries: FeedEntry[];
  isLoading: boolean;
  hasNotes: boolean;
  hasJournals: boolean;
  onEntryClick: (entry: FeedEntry) => void;
  moodsByDate?: Record<string, DailyMood[]>;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  neutral: '😐',
  sick: '🤒',
  anxious: '😰',
  tired: '😴',
  excited: '🤩',
  fear: '😨',
  disgust: '🤢',
  surprise: '😮',
};

// Loading skeleton component
function FeedCardSkeleton() {
  return (
    <div className="flex gap-4 p-4 rounded-lg animate-pulse">
      <div className="w-30 h-20 flex-shrink-0 rounded-lg bg-neutral-200 dark:bg-dark-600" />
      <div className="flex-1 min-w-0">
        <div className="h-5 bg-neutral-200 dark:bg-dark-600 rounded mb-2 w-3/4" />
        <div className="h-4 bg-neutral-200 dark:bg-dark-600 rounded w-1/3" />
      </div>
    </div>
  );
}

export function FeedList({ entries, isLoading, hasNotes, hasJournals, onEntryClick, moodsByDate }: FeedListProps) {
  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, FeedEntry[]>);

  // Get dates that have moods but no entries
  const moodOnlyDates = useMemo(() => {
    if (!moodsByDate) return [];

    return Object.keys(moodsByDate)
      .filter(dateKey => {
        // Parse date string as local date (not UTC) to avoid timezone issues
        const [year, month, day] = dateKey.split('-').map(Number);
        const dateKeyDate = new Date(year, month - 1, day).toDateString();
        // Only include if this date has moods but no entries
        return moodsByDate[dateKey].length > 0 && !groupedEntries[dateKeyDate];
      })
      .map(dateKey => {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day).toDateString();
      });
  }, [moodsByDate, groupedEntries]);

  // Combine entry dates and mood-only dates, sort descending (newest first)
  const allDates = useMemo(() => {
    const entryDates = Object.keys(groupedEntries);
    const combined = [...entryDates, ...moodOnlyDates];
    return Array.from(new Set(combined)).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedEntries, moodOnlyDates]);

  // Sort dates descending (newest first)
  const dates = allDates;

  // Get mood indicators for a date
  const getMoodIndicators = (dateString: string) => {
    const dateKey = format(new Date(dateString), 'yyyy-MM-dd');
    const moods = moodsByDate?.[dateKey];
    if (!moods || moods.length === 0) return null;

    const morningMood = moods.find(m => m.timeOfDay === 'morning');
    const afternoonMood = moods.find(m => m.timeOfDay === 'afternoon');

    return (
      <div className="flex items-center gap-1.5 ml-3">
        {morningMood && (
          <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
            <span className="text-[9px] font-semibold text-yellow-700 dark:text-yellow-300 uppercase leading-none">am</span>
            <span className="text-sm" title={`Morning: ${morningMood.mood}`}>
              {MOOD_EMOJIS[morningMood.mood] || '😐'}
            </span>
          </div>
        )}
        {afternoonMood && (
          <div className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
            <span className="text-[9px] font-semibold text-orange-700 dark:text-orange-300 uppercase leading-none">pm</span>
            <span className="text-sm" title={`Afternoon: ${afternoonMood.mood}`}>
              {MOOD_EMOJIS[afternoonMood.mood] || '😐'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-white dark:bg-dark-800 rounded-lg p-6 shadow-sm">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      </div>
    );
  }

  // Show empty state
  if (entries.length === 0 && allDates.length === 0) {
    return <EmptyFeedState hasNotes={hasNotes} hasJournals={hasJournals} />;
  }

  // Show grouped entries
  return (
    <div className="flex flex-col gap-8">
      {dates.map((date) => {
        const hasEntries = groupedEntries[date] && groupedEntries[date].length > 0;

        return (
          <div key={date} className="bg-white dark:bg-dark-800 rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-neutral-200 dark:border-dark-600">
              <div className="flex items-center">
                <h3 className="text-xl text-neutral-900 dark:text-dark-50 m-0">
                  {formatDate(date)}
                </h3>
                {getMoodIndicators(date)}
              </div>
              <span className="text-sm text-neutral-500 dark:text-dark-400">
                {hasEntries
                  ? `${groupedEntries[date].length} ${groupedEntries[date].length === 1 ? 'entry' : 'entries'}`
                  : 'No entries'}
              </span>
            </div>

            {hasEntries ? (
              <div className="grid gap-4">
                {groupedEntries[date].map((entry) => (
                  <FeedCard key={entry.id} entry={entry} onClick={() => onEntryClick(entry)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500 dark:text-dark-400">
                <p className="text-sm">No journal or note entries for this day</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
