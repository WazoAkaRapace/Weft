import { useState, useEffect, useCallback } from 'react';
import type { Note } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface NoteTreeNode {
  note: Note;
  children: NoteTreeNode[];
  level: number;
}

export interface CreateNoteData {
  title: string;
  content?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  position?: number;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  position?: number;
}

interface UseNotesReturn {
  notes: Note[];
  noteTree: NoteTreeNode[];
  isLoading: boolean;
  error: Error | null;
  createNote: (data: CreateNoteData) => Promise<Note>;
  updateNote: (id: string, data: UpdateNoteData) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (notes: Array<{ id: string; position: number; parentId?: string | null }>) => Promise<void>;
  refresh: () => void;
}

/**
 * Build hierarchical tree structure from flat notes array
 */
function buildNoteTree(notes: Note[]): NoteTreeNode[] {
  const noteMap = new Map<string, NoteTreeNode>();
  const rootNodes: NoteTreeNode[] = [];

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
  const sortNodes = (nodes: NoteTreeNode[]) => {
    nodes.sort((a, b) => a.note.position - b.note.position);
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootNodes);

  return rootNodes;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/notes`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }

      const result = await response.json() as { notes: Note[] };
      setNotes(result.notes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNote = useCallback(async (data: CreateNoteData): Promise<Note> => {
    const response = await fetch(`${API_BASE}/api/notes`, {
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

    // Optimistically add to local state
    setNotes(prev => [...prev, createdNote]);

    return createdNote;
  }, []);

  const updateNote = useCallback(async (id: string, data: UpdateNoteData): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/notes/${id}`, {
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

    // Update local state
    setNotes(prev => prev.map(note =>
      note.id === id ? updatedNote : note
    ));
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/notes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }

    // Remove from local state (soft delete)
    setNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const reorderNotes = useCallback(async (notes: Array<{ id: string; position: number; parentId?: string | null }>): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/notes/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reorder notes: ${response.statusText}`);
    }

    // Update local state with new positions and parentIds
    setNotes(prev => {
      const updateMap = new Map(notes.map(n => [n.id, { position: n.position, parentId: n.parentId }]));
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
    fetchNotes();
  }, [fetchNotes]);

  const noteTree = buildNoteTree(notes);

  return {
    notes,
    noteTree,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    reorderNotes,
    refresh,
  };
}
