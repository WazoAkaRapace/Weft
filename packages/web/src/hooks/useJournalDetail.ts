import { useState, useEffect, useCallback } from 'react';
import type { JournalWithTranscript, Transcript } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseJournalDetailReturn {
  journal: JournalWithTranscript | null;
  isLoading: boolean;
  error: Error | null;
  updateNotes: (notes: string) => Promise<void>;
  refresh: () => void;
}

export function useJournalDetail(journalId: string): UseJournalDetailReturn {
  const [journal, setJournal] = useState<JournalWithTranscript | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJournalAndTranscript = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch journal details
      const journalResponse = await fetch(
        `${API_BASE}/api/journals/${journalId}`,
        {
          credentials: 'include',
        }
      );

      if (!journalResponse.ok) {
        if (journalResponse.status === 404) {
          throw new Error('Journal not found');
        }
        if (journalResponse.status === 403) {
          throw new Error('Access denied');
        }
        throw new Error(`Failed to fetch journal: ${journalResponse.statusText}`);
      }

      const journalData = (await journalResponse.json()) as JournalWithTranscript;

      // Fetch transcript
      const transcriptResponse = await fetch(
        `${API_BASE}/api/journals/${journalId}/transcript`,
        {
          credentials: 'include',
        }
      );

      if (transcriptResponse.ok) {
        const transcriptData = (await transcriptResponse.json()) as Transcript;
        journalData.transcript = transcriptData;
      } else if (transcriptResponse.status === 202) {
        // Transcription in progress
        // We'll leave transcript as undefined
      } else if (transcriptResponse.status !== 404) {
        // 404 means no transcript exists yet, which is fine
        console.warn('Failed to fetch transcript:', transcriptResponse.statusText);
      }

      setJournal(journalData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [journalId]);

  const updateNotes = useCallback(
    async (notes: string) => {
      try {
        const response = await fetch(`${API_BASE}/api/journals/${journalId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update notes: ${response.statusText}`);
        }

        // Update local state with the returned journal
        const updatedJournal = (await response.json()) as JournalWithTranscript;
        setJournal((prev) =>
          prev ? { ...prev, notes: updatedJournal.notes } : prev
        );
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to save notes');
      }
    },
    [journalId]
  );

  const refresh = useCallback(() => {
    fetchJournalAndTranscript();
  }, [fetchJournalAndTranscript]);

  useEffect(() => {
    fetchJournalAndTranscript();
  }, [fetchJournalAndTranscript]);

  return {
    journal,
    isLoading,
    error,
    updateNotes,
    refresh,
  };
}
