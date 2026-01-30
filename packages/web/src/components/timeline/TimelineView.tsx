import type { Journal } from '@weft/shared';
import { useState, useCallback } from 'react';
import { EmotionBadge } from '../emotions/EmotionBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TimelineViewProps {
  journals: Journal[];
  onJournalClick: (journalId: string) => void;
  onRetryTranscription?: (journalId: string) => void;
  onRetryEmotion?: (journalId: string) => void;
  isLoading: boolean;
  formatDuration: (seconds: number) => string;
}

export function TimelineView({
  journals,
  onJournalClick,
  onRetryTranscription,
  onRetryEmotion,
  isLoading,
  formatDuration,
}: TimelineViewProps) {
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [retryingEmotionIds, setRetryingEmotionIds] = useState<Set<string>>(new Set());

  const handleRetry = useCallback(async (journalId: string) => {
    setRetryingIds(prev => new Set(prev).add(journalId));
    try {
      await onRetryTranscription?.(journalId);
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(journalId);
        return newSet;
      });
    }
  }, [onRetryTranscription]);

  const handleRetryEmotion = useCallback(async (journalId: string) => {
    setRetryingEmotionIds(prev => new Set(prev).add(journalId));
    try {
      await onRetryEmotion?.(journalId);
    } finally {
      setRetryingEmotionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(journalId);
        return newSet;
      });
    }
  }, [onRetryEmotion]);

  // Group journals by date
  const groupedJournals = journals.reduce((acc, journal) => {
    const date = new Date(journal.createdAt).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(journal);
    return acc;
  }, {} as Record<string, Journal[]>);

  const dates = Object.keys(groupedJournals).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="flex flex-col gap-8">
      {dates.map((date) => (
        <div key={date} className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-border-light dark:border-gray-700">
            <h3 className="text-xl text-text-default dark:text-text-dark-default m-0">
              {formatDate(date)}
            </h3>
            <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
              {groupedJournals[date].length} {groupedJournals[date].length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="grid gap-4">
            {groupedJournals[date].map((journal) => (
              <div
                key={journal.id}
                className="flex gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => onJournalClick(journal.id)}
              >
                <div className="w-30 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
                  {journal.thumbnailPath ? (
                    <img
                      src={`${API_BASE}${journal.thumbnailPath.replace('/app', '')}`}
                      alt={journal.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center" />
                  )}
                  <div className="absolute bottom-1 left-1 flex items-center gap-1.5">
                    {journal.dominantEmotion && (
                      <EmotionBadge emotion={journal.dominantEmotion} showLabel={false} className="text-xs px-1.5 py-0.5" />
                    )}
                    <span className="bg-black/70 text-white px-1.5 py-0.5 rounded text-xs">
                      {formatDuration(journal.duration)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-medium text-text-default dark:text-text-dark-default m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {journal.title}
                  </h4>
                  <p className="text-sm text-text-secondary dark:text-text-dark-secondary m-0 mb-2">
                    {formatTime(journal.createdAt)}
                  </p>
                  {journal.transcriptPreview && (
                    <p className="text-sm text-text-default dark:text-text-dark-default m-0.5 mb-0 p-2 bg-gray-50 dark:bg-gray-800/50 rounded italic line-clamp-3 overflow-hidden">
                      {journal.transcriptPreview}
                    </p>
                  )}
                  {journal.notes && (
                    <p className="text-sm text-text-default dark:text-text-dark-default m-0.5 mb-0 line-clamp-2 overflow-hidden">
                      {journal.notes}
                    </p>
                  )}
                  {journal.location && (
                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary m-0.5 mb-0 mt-2">
                      📍 {journal.location}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-2 py-1 bg-primary-light dark:bg-primary/20 text-primary dark:text-primary text-xs font-medium rounded cursor-pointer transition-all hover:bg-primary hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(journal.id);
                      }}
                      disabled={retryingIds.has(journal.id)}
                      title="Retry transcription"
                    >
                      {retryingIds.has(journal.id) ? 'Retrying...' : '🔄 Retry Transcription'}
                    </button>
                    <button
                      className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded cursor-pointer transition-all hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryEmotion(journal.id);
                      }}
                      disabled={retryingEmotionIds.has(journal.id)}
                      title="Retry emotion analysis"
                    >
                      {retryingEmotionIds.has(journal.id) ? 'Analyzing...' : '😊 Retry Emotion'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
          Loading more journals...
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
