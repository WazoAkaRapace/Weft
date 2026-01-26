import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useJournals } from '../hooks/useJournals';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { JournalListParams } from '@weft/shared';
import { TimelineView } from '../components/timeline/TimelineView';
import { DateFilter } from '../components/timeline/DateFilter';
import { formatDuration } from '../lib/video-stream';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function HistoryPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
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
      page: 1, // Reset to first page when filters change
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
    // Navigate to journal detail view (future feature)
    console.log('View journal:', journalId);
  }, []);

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

      // Refresh journals to update the transcription status
      refresh();
    } catch (error) {
      console.error('Failed to retry transcription:', error);
      throw error;
    }
  }, [refresh]);

  if (error) {
    return (
      <div className="history-container">
        <header className="history-header">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Back to Dashboard
          </button>
          <h1>Journal History</h1>
          <div className="user-info">
            <span className="user-name">{session?.user?.name || 'User'}</span>
          </div>
        </header>
        <main className="history-main">
          <div className="error-message">
            Error loading journals: {error.message}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="history-container">
      <header className="history-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Journal History</h1>
        <div className="user-info">
          <span className="user-name">{session?.user?.name || 'User'}</span>
        </div>
      </header>

      <main className="history-main">
        <div className="history-controls">
          <DateFilter
            onFilterChange={handleDateFilterChange}
            initialParams={filterParams}
          />
        </div>

        <TimelineView
          journals={journals}
          onJournalClick={handleJournalClick}
          onRetryTranscription={handleRetryTranscription}
          isLoading={isLoading}
          formatDuration={formatDuration}
        />

        {/* Infinite scroll sentinel */}
        <div ref={infiniteScrollTarget} className="scroll-sentinel" />

        {pagination?.hasNextPage && !isLoading && (
          <div className="load-more-container">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="load-more-button"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {journals.length === 0 && !isLoading && (
          <div className="empty-state">
            <h2>No journals found</h2>
            <p>Start recording to see your journal history here.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="primary-button"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
