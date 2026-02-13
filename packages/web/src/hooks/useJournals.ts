import { useState, useEffect, useCallback } from 'react';
import type { JournalListParams, PaginatedResponse, Journal } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseJournalsReturn {
  journals: Journal[];
  pagination: PaginatedResponse<Journal>['pagination'] | null;
  isLoading: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
}

export function useJournals(params: JournalListParams): UseJournalsReturn {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<Journal>['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchJournals = useCallback(async (append = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', params.page.toString());
      queryParams.append('limit', params.limit.toString());

      if (params.startDate) {
        queryParams.append('startDate', params.startDate.toISOString());
      }
      if (params.endDate) {
        queryParams.append('endDate', params.endDate.toISOString());
      }
      if (params.search) {
        queryParams.append('search', params.search);
      }

      const response = await fetch(
        `${API_BASE}/api/journals/paginated?${queryParams.toString()}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch journals: ${response.statusText}`);
      }

      const result = await response.json() as PaginatedResponse<Journal>;

      setJournals(prev =>
        append ? [...prev, ...result.data] : result.data
      );
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  const refresh = useCallback(() => {
    fetchJournals(false);
  }, [fetchJournals]);

  const loadMore = useCallback(() => {
    if (pagination?.hasNextPage && !isLoading) {
      fetchJournals(true);
    }
  }, [pagination?.hasNextPage, isLoading, fetchJournals]);

  useEffect(() => {
    fetchJournals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-fetch when specific params change, not when fetchJournals reference changes
  }, [params.page, params.limit, params.startDate, params.endDate, params.search]);

  return {
    journals,
    pagination,
    isLoading,
    error,
    loadMore,
    refresh,
  };
}
