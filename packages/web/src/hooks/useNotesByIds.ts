import { useState, useCallback } from 'react';
import type { Note } from '@weft/shared';
import { getApiUrl } from '../lib/config';

interface UseNotesByIdsReturn {
  notes: Note[];
  isLoading: boolean;
  error: Error | null;
  fetch: (ids: string[]) => Promise<Note[]>;
}

/**
 * Hook to fetch full note content by IDs (bulk fetch)
 * Used to fetch content only for selected notes after user confirms selection
 */
export function useNotesByIds(): UseNotesByIdsReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotes = useCallback(async (ids: string[]): Promise<Note[]> => {
    if (ids.length === 0) {
      setNotes([]);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/notes/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }

      const result = await response.json() as { notes: Note[] };
      setNotes(result.notes);
      return result.notes;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    notes,
    isLoading,
    error,
    fetch: fetchNotes,
  };
}
