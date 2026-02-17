import { useState, useEffect, useCallback } from 'react';
import type { Note } from '@weft/shared';
import { getApiUrl } from '../lib/config';

export interface NoteTitleData {
  id: string;
  title: string;
  icon: string;
  color: string | null;
  parentId: string | null;
  position: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface NoteTitleTreeNode {
  note: NoteTitleData;
  children: NoteTitleTreeNode[];
  level: number;
}

export interface CreateNoteData {
  title: string;
  content?: string;
  icon?: string;
  color?: string | null;
  parentId?: string | null;
  position?: number;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  icon?: string;
  color?: string | null;
  parentId?: string | null;
  position?: number;
}

interface UseNoteTitlesOptions {
  fetchOnMount?: boolean;
}

interface UseNoteTitlesReturn {
  notes: NoteTitleData[];
  noteTree: NoteTitleTreeNode[];
  isLoading: boolean;
  error: Error | null;
  fetch: () => Promise<void>;
  createNote: (data: CreateNoteData) => Promise<NoteTitleData>;
  updateNote: (id: string, data: UpdateNoteData) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (notes: Array<{ id: string; position: number; parentId?: string | null }>) => Promise<void>;
  refresh: () => void;
}

/**
 * Build hierarchical tree structure from flat notes array
 */
function buildNoteTree(notes: NoteTitleData[]): NoteTitleTreeNode[] {
  const noteMap = new Map<string, NoteTitleTreeNode>();
  const rootNodes: NoteTitleTreeNode[] = [];

  // First pass: create all nodes
  notes.forEach(note => {
    noteMap.set(note.id, { note, children: [], level: 0 });
  });

  // Second pass: build hierarchy
  notes.forEach(note => {
    const node = noteMap.get(note.id);
    if (!node) return;
    if (note.parentId && noteMap.has(note.parentId)) {
      const parent = noteMap.get(note.parentId);
      if (parent) {
        parent.children.push(node);
        node.level = parent.level + 1;
      }
    } else {
      rootNodes.push(node);
    }
  });

  // Sort by position
  const sortNodes = (nodes: NoteTitleTreeNode[]) => {
    nodes.sort((a, b) => a.note.position - b.note.position);
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootNodes);

  return rootNodes;
}

/**
 * Convert a full Note object to NoteTitleData (strips content)
 */
function noteToTitleData(note: Note): NoteTitleData {
  return {
    id: note.id,
    title: note.title,
    icon: note.icon,
    color: note.color,
    parentId: note.parentId,
    position: note.position,
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
  };
}

/**
 * Hook to fetch lightweight note metadata (no content)
 * Used for note pickers and sidebar that only need titles and hierarchy info
 */
export function useNoteTitles(options: UseNoteTitlesOptions = {}): UseNoteTitlesReturn {
  const { fetchOnMount = true } = options;
  const [notes, setNotes] = useState<NoteTitleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/notes/titles`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch note titles: ${response.statusText}`);
      }

      const result = await response.json() as { notes: NoteTitleData[] };
      setNotes(result.notes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNote = useCallback(async (data: CreateNoteData): Promise<NoteTitleData> => {
    const response = await fetch(`${getApiUrl()}/api/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create note: ${response.statusText}`);
    }

    const createdNote = await response.json() as Note;
    const titleData = noteToTitleData(createdNote);

    // Optimistically add to local state
    setNotes(prev => [...prev, titleData]);

    return titleData;
  }, []);

  const updateNote = useCallback(async (id: string, data: UpdateNoteData): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/api/notes/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }

    const updatedNote = await response.json() as Note;
    const titleData = noteToTitleData(updatedNote);

    // Update local state
    setNotes(prev => prev.map(note =>
      note.id === id ? titleData : note
    ));
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/api/notes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }

    // Remove from local state
    setNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const reorderNotes = useCallback(async (notesToReorder: Array<{ id: string; position: number; parentId?: string | null }>): Promise<void> => {
    const response = await fetch(`${getApiUrl()}/api/notes/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: notesToReorder }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reorder notes: ${response.statusText}`);
    }

    // Update local state with new positions and parentIds
    setNotes(prev => {
      const updateMap = new Map(notesToReorder.map(n => [n.id, { position: n.position, parentId: n.parentId }]));
      return prev.map(note => {
        const update = updateMap.get(note.id);
        if (update) {
          return {
            ...note,
            position: update.position,
            ...(update.parentId !== undefined && { parentId: update.parentId }),
          };
        }
        return note;
      });
    });
  }, []);

  const refresh = useCallback(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (fetchOnMount) {
      fetchNotes();
    }
  }, [fetchOnMount, fetchNotes]);

  const noteTree = buildNoteTree(notes);

  return {
    notes,
    noteTree,
    isLoading,
    error,
    fetch: fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    reorderNotes,
    refresh,
  };
}

/**
 * Convert NoteTitleData to Note type for compatibility with existing components
 * Note: content will be undefined
 */
export function toNote(noteTitle: NoteTitleData): Note {
  return {
    ...noteTitle,
    content: null,
    userId: '',
  } as Note;
}
