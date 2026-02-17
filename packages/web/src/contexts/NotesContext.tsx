import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useNoteTitles, type NoteTitleTreeNode, type CreateNoteData, type UpdateNoteData } from '../hooks/useNoteTitles';

// Use NoteTitleTreeNode as the tree node type - compatible with sidebar rendering
type NoteTreeNode = NoteTitleTreeNode;

interface NotesContextValue {
  // Data
  notes: NoteTreeNode[];
  isLoading: boolean;
  error: Error | null;

  // UI State
  selectedNoteId: string | null;
  expandedNodeIds: Set<string>;
  isCreating: boolean;
  creatingParentId: string | null;

  // Actions
  selectNote: (id: string | null) => void;
  toggleNode: (id: string) => void;
  expandNode: (id: string) => void;
  collapseNode: (id: string) => void;
  startCreating: (parentId: string | null) => void;
  cancelCreating: () => void;
  createNote: (data: CreateNoteData) => Promise<{ id: string }>;
  updateNote: (id: string, data: UpdateNoteData) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (notes: Array<{ id: string; position: number; parentId?: string | null }>) => Promise<void>;
  refresh: () => void;

  // Computed
  getSelectedNote: () => NoteTreeNode | null;
  getChildNotes: (parentId: string | null) => NoteTreeNode[];
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

interface NotesProviderProps {
  children: ReactNode;
  initialNoteId?: string | null;
}

export function NotesProvider({ children, initialNoteId = null }: NotesProviderProps) {
  const { noteTree, isLoading, error, createNote: createNoteApi, updateNote: updateNoteApi, deleteNote: deleteNoteApi, reorderNotes, refresh } = useNoteTitles();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialNoteId);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const lastExpandedNoteIdRef = useRef<string | null>(null);

  // Update selected note when initialNoteId changes (from URL)
  useEffect(() => {
    if (initialNoteId && initialNoteId !== lastExpandedNoteIdRef.current && !isLoading && noteTree.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync URL state to component state
      setSelectedNoteId(initialNoteId);

      // Expand parent nodes and the note itself if it has children
      const findAndExpandParents = (nodes: NoteTreeNode[], targetId: string, path: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.note.id === targetId) {
            const idsToExpand = [...path];

            // Expand the selected node itself if it has children
            if (node.children.length > 0) {
              idsToExpand.push(node.note.id);
            }

            return idsToExpand;
          }
          if (node.children.length > 0) {
            const result = findAndExpandParents(node.children, targetId, [...path, node.note.id]);
            if (result) return result;
          }
        }
        return null;
      };

      const idsToExpand = findAndExpandParents(noteTree, initialNoteId);
      if (idsToExpand) {
        setExpandedNodeIds(prev => new Set([...prev, ...idsToExpand]));
        lastExpandedNoteIdRef.current = initialNoteId;
      }
    }
  }, [initialNoteId, isLoading, noteTree]);

  const selectNote = useCallback((id: string | null) => {
    setSelectedNoteId(id);

    // Expand parent nodes when selecting a note, and expand the note itself if it has children
    if (id) {
      const findAndExpandParents = (nodes: NoteTreeNode[], targetId: string, path: string[] = []): boolean => {
        for (const node of nodes) {
          if (node.note.id === targetId) {
            // Expand all parents in the path
            path.forEach(parentId => {
              setExpandedNodeIds(prev => new Set([...prev, parentId]));
            });

            // Expand the selected node itself if it has children
            if (node.children.length > 0) {
              setExpandedNodeIds(prev => new Set([...prev, node.note.id]));
            }

            return true;
          }
          if (node.children.length > 0) {
            if (findAndExpandParents(node.children, targetId, [...path, node.note.id])) {
              return true;
            }
          }
        }
        return false;
      };

      findAndExpandParents(noteTree, id);
    }
  }, [noteTree]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const expandNode = useCallback((id: string) => {
    setExpandedNodeIds(prev => new Set([...prev, id]));
  }, []);

  const collapseNode = useCallback((id: string) => {
    setExpandedNodeIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const startCreating = useCallback((parentId: string | null) => {
    setIsCreating(true);
    setCreatingParentId(parentId);

    // Expand parent if creating a child
    if (parentId) {
      expandNode(parentId);
    }
  }, [expandNode]);

  const cancelCreating = useCallback(() => {
    setIsCreating(false);
    setCreatingParentId(null);
  }, []);

  const createNote = useCallback(async (data: CreateNoteData) => {
    const createdNote = await createNoteApi(data);

    // Auto-select the new note
    selectNote(createdNote.id);

    // Expand parent if this is a child note
    if (createdNote.parentId) {
      expandNode(createdNote.parentId);
    }

    // Clear creation state
    setIsCreating(false);
    setCreatingParentId(null);

    // Return the created note ID so caller can navigate to it
    return { id: createdNote.id };
  }, [createNoteApi, selectNote, expandNode]);

  const updateNote = useCallback(async (id: string, data: UpdateNoteData) => {
    await updateNoteApi(id, data);
  }, [updateNoteApi]);

  const deleteNote = useCallback(async (id: string) => {
    await deleteNoteApi(id);

    // Clear selection if deleting selected note
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  }, [deleteNoteApi, selectedNoteId]);

  const getSelectedNote = useCallback((): NoteTreeNode | null => {
    if (!selectedNoteId) return null;

    const findNode = (nodes: NoteTreeNode[]): NoteTreeNode | null => {
      for (const node of nodes) {
        if (node.note.id === selectedNoteId) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findNode(noteTree);
  }, [selectedNoteId, noteTree]);

  const getChildNotes = useCallback((parentId: string | null): NoteTreeNode[] => {
    if (parentId === null) {
      return noteTree;
    }

    const findNode = (nodes: NoteTreeNode[]): NoteTreeNode | null => {
      for (const node of nodes) {
        if (node.note.id === parentId) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const parent = findNode(noteTree);
    return parent?.children || [];
  }, [noteTree]);

  const value = useMemo<NotesContextValue>(
    () => ({
      notes: noteTree,
      isLoading,
      error,
      selectedNoteId,
      expandedNodeIds,
      isCreating,
      creatingParentId,
      selectNote,
      toggleNode,
      expandNode,
      collapseNode,
      startCreating,
      cancelCreating,
      createNote,
      updateNote,
      deleteNote,
      reorderNotes,
      refresh,
      getSelectedNote,
      getChildNotes,
    }),
    [
      noteTree,
      isLoading,
      error,
      selectedNoteId,
      expandedNodeIds,
      isCreating,
      creatingParentId,
      selectNote,
      toggleNode,
      expandNode,
      collapseNode,
      startCreating,
      cancelCreating,
      createNote,
      updateNote,
      deleteNote,
      reorderNotes,
      refresh,
      getSelectedNote,
      getChildNotes,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotesContext() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesContext must be used within a NotesProvider');
  }
  return context;
}
