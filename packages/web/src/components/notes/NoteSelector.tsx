import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { NestedNoteList } from './shared';
import { filterTreeBySearch, countNotesInTree } from './shared/noteTreeUtils';

interface NoteSelectorProps {
  selectedNoteIds: string[];
  onSelectionChange: (noteIds: string[]) => void;
  excludeIds?: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function NoteSelector({
  selectedNoteIds,
  onSelectionChange,
  excludeIds = [],
  isOpen,
  onClose,
}: NoteSelectorProps) {
  const { noteTree, isLoading } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Internal selection state - initialized from prop when modal opens
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());

  const excludeIdsSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  // Track previous isOpen state to detect when modal opens
  const prevIsOpenRef = useRef(isOpen);

  // Initialize internal state when modal opens (transitions from closed to open)
  // Start with selectedNoteIds but exclude any that are in excludeIds (already linked)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const initialSelected = new Set(
        selectedNoteIds.filter((id) => !excludeIds.includes(id))
      );
      setInternalSelectedIds(initialSelected);
      setSearchQuery('');
      setExpandedNodeIds(new Set());
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, selectedNoteIds, excludeIds]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close handler
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Filter notes by search query
  const filteredTree = useMemo(() => {
    return filterTreeBySearch(noteTree, searchQuery);
  }, [noteTree, searchQuery]);

  // Toggle expand/collapse
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Toggle note selection
  const toggleNote = useCallback(
    (noteId: string, _shiftKey: boolean) => {
      if (excludeIds.includes(noteId)) return;

      setInternalSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
    },
    [excludeIds]
  );

  // Handle confirm - pass selection to parent
  const handleConfirm = useCallback(() => {
    onSelectionChange(Array.from(internalSelectedIds));
    onClose();
  }, [internalSelectedIds, onSelectionChange, onClose]);

  // Handle clear - clear only internal selections
  const handleClear = useCallback(() => {
    setInternalSelectedIds(new Set());
  }, []);

  // Count total notes (excluding excluded)
  const availableCount = useMemo(() => {
    return countNotesInTree(noteTree, excludeIdsSet);
  }, [noteTree, excludeIdsSet]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-text-default dark:text-text-dark-default">
            Select Notes
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-neutral-200 dark:border-dark-600">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full px-3 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-text-default dark:text-text-dark-default"
            autoFocus
          />
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
              Loading notes...
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
              {searchQuery ? 'No notes match your search.' : 'No notes available.'}
            </div>
          ) : (
            <NestedNoteList
              nodes={filteredTree}
              level={0}
              expandedNodeIds={expandedNodeIds}
              selectedIds={internalSelectedIds}
              disabledIds={excludeIdsSet}
              onToggleNode={toggleNode}
              onToggleItem={toggleNote}
              variant="full"
              showDate={false}
              showPreview={false}
              showChildCount={false}
              showAddedBadge={true}
              enableShiftSelect={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-200 dark:border-dark-600">
          <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {internalSelectedIds.size} selected
            {availableCount > 0 && ` of ${availableCount} available`}
          </span>
          <div className="flex gap-2">
            {internalSelectedIds.size > 0 && (
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
