import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJournals } from '../hooks/useJournals';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { JournalListParams } from '@weft/shared';
import { TimelineView } from '../components/timeline/TimelineView';
import { DateFilter } from '../components/timeline/DateFilter';
import { formatDuration } from '../lib/video-stream';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function HistoryPage() {
  const navigate = useNavigate();
  const [filterParams, setFilterParams] = useState<JournalListParams>({
    page: 1,
    limit: 20,
  });

  const {
    journals,
    pagination,
    isLoading,
    error,
    loadMore,
    refresh,
  } = useJournals(filterParams);

  const infiniteScrollTarget = useInfiniteScroll({
    isLoading,
    hasNextPage: pagination?.hasNextPage || false,
    onLoadMore: loadMore,
  });

  const handleDateFilterChange = useCallback((params: Partial<JournalListParams>) => {
    setFilterParams(prev => ({
      ...prev,
      ...params,
      page: 1,
    }));
  }, []);

  const handleLoadMore = useCallback(() => {
    if (pagination?.hasNextPage && !isLoading) {
      setFilterParams(prev => ({
        ...prev,
        page: prev.page + 1,
      }));
    }
  }, [pagination?.hasNextPage, isLoading]);

  const handleJournalClick = useCallback((journalId: string) => {
    navigate(`/journal/${journalId}`);
  }, [navigate]);

  const handleRetryTranscription = useCallback(async (journalId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/journals/${journalId}/transcription/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry transcription: ${response.statusText}`);
      }

      refresh();
    } catch (error) {
      console.error('Failed to retry transcription:', error);
      throw error;
    }
  }, [refresh]);

  const handleRetryEmotion = useCallback(async (journalId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/journals/${journalId}/emotions/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry emotion analysis: ${response.statusText}`);
      }

      refresh();
    } catch (error) {
      console.error('Failed to retry emotion analysis:', error);
      throw error;
    }
  }, [refresh]);

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-4 text-danger text-center">
          Error loading journals: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <DateFilter
            onFilterChange={handleDateFilterChange}
            initialParams={filterParams}
          />
        </div>

        <TimelineView
          journals={journals}
          onJournalClick={handleJournalClick}
          onRetryTranscription={handleRetryTranscription}
          onRetryEmotion={handleRetryEmotion}
          isLoading={isLoading}
          formatDuration={formatDuration}
        />

        {/* Infinite scroll sentinel */}
        <div ref={infiniteScrollTarget} className="h-px" />

        {pagination?.hasNextPage && !isLoading && (
          <div className="flex justify-center py-8">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="px-8 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {journals.length === 0 && !isLoading && (
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center">
            <h2 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
              No journals found
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-8">
              Start recording to see your journal history here.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    );
}
