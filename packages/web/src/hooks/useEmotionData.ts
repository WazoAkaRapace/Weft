/**
 * Custom hook for fetching emotion data
 */

import { useState, useEffect, useCallback } from 'react';
import type { EmotionData } from '../components/emotions/types';
import { getApiUrl } from '../lib/config';

export interface UseEmotionDataResult {
  data: EmotionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmotionData(journalId: string): UseEmotionDataResult {
  const [data, setData] = useState<EmotionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmotionData = useCallback(async () => {
    if (!journalId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/journals/${journalId}/emotions`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No emotion data yet
          setData(null);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch emotion data: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result.data);
    } catch (err) {
      console.error('Failed to fetch emotion data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    fetchEmotionData();
  }, [fetchEmotionData]);

  return {
    data,
    loading,
    error,
    refetch: fetchEmotionData,
  };
}
