import { useCallback } from 'react';
import type { Note } from '@weft/shared';
import type { NoteTreeNode } from '../../../hooks/useNotes';

/**
 * Flatten the note tree in depth-first traversal order (parents before children)
 */
export function flattenNoteTree(nodes: NoteTreeNode[]): Note[] {
  const result: Note[] = [];
  for (const node of nodes) {
    result.push(node.note);
    result.push(...flattenNoteTree(node.children));
  }
  return result;
}

/**
 * Get all descendant note IDs from a node (including the node itself)
 */
export function getDescendantIds(node: NoteTreeNode): string[] {
  const ids = [node.note.id];
  for (const child of node.children) {
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

/**
 * Find a node by ID in the tree
 */
export function findNodeInTree(nodes: NoteTreeNode[], id: string): NoteTreeNode | null {
  for (const node of nodes) {
    if (node.note.id === id) return node;
    const found = findNodeInTree(node.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Filter the note tree by search query
 */
export function filterTreeBySearch(nodes: NoteTreeNode[], query: string): NoteTreeNode[] {
  if (!query) return nodes;

  const lowerQuery = query.toLowerCase();

  const filterNode = (node: NoteTreeNode): NoteTreeNode | null => {
    const matchesSearch =
      node.note.title.toLowerCase().includes(lowerQuery) ||
      (node.note.content && node.note.content.toLowerCase().includes(lowerQuery));

    const filteredChildren = node.children
      .map(filterNode)
      .filter((child): child is NoteTreeNode => child !== null);

    if (matchesSearch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  return nodes.map(filterNode).filter((node): node is NoteTreeNode => node !== null);
}

/**
 * Count total notes in tree (excluding specified IDs)
 */
export function countNotesInTree(nodes: NoteTreeNode[], excludeIds: Set<string> = new Set()): number {
  let count = 0;
  for (const node of nodes) {
    if (!excludeIds.has(node.note.id)) {
      count++;
    }
    count += countNotesInTree(node.children, excludeIds);
  }
  return count;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return '';
  }
}

/**
 * Convert date to ISO string safely
 */
export function toISOString(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;

  if (typeof date === 'string') {
    return date;
  }

  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Hook to handle shift+click selection logic for note trees
 */
export function useNoteTreeSelection(
  noteTree: NoteTreeNode[],
  selectedItems: Set<string>,
  setSelectedItems: React.Dispatch<React.SetStateAction<Set<string>>>,
  preSelectedIds: Set<string> = new Set()
) {
  const handleToggleItem = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelectedItems((prev) => {
        const newSet = new Set(prev);

        // If shift key is pressed, toggle the node and all its children
        if (shiftKey) {
          const node = findNodeInTree(noteTree, id);
          if (node) {
            const allIds = getDescendantIds(node);
            const allIdsExcludingAlreadySelected = allIds.filter(
              (noteId) => !preSelectedIds.has(noteId)
            );

            // Check if the parent is currently selected
            const isParentSelected = prev.has(id) || preSelectedIds.has(id);

            if (isParentSelected) {
              // Deselect all
              allIdsExcludingAlreadySelected.forEach((noteId) => newSet.delete(noteId));
            } else {
              // Select all
              allIdsExcludingAlreadySelected.forEach((noteId) => newSet.add(noteId));
            }
          }
        } else {
          // Normal toggle for single item
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
        }

        return newSet;
      });
    },
    [noteTree, preSelectedIds, setSelectedItems]
  );

  return handleToggleItem;
}
