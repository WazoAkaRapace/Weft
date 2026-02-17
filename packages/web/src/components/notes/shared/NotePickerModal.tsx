import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Journal, Note } from '@weft/shared';
import type { NoteTreeNode } from '../../../hooks/useNotes';
import type { ContextItem } from '../../../hooks/useAIChat';
import { NestedNoteList } from './NestedNoteList';
import {
  flattenNoteTree,
  filterTreeBySearch,
  formatDate,
  toISOString,
  useNoteTreeSelection,
} from './noteTreeUtils';
import { ThemeIcon } from '../../ui/ThemeIcon';

export interface NotePickerSelection {
  notes: Array<{ id: string; title: string; content?: string; date?: string }>;
  journals?: Array<{ id: string; title: string; content?: string; date?: string }>;
  noteIds: string[];
  journalIds: string[];
  contextItems?: ContextItem[];
}

export interface NotePickerModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Data (passed in from hooks)
  noteTree: NoteTreeNode[];
  notes: Note[];
  journals?: Journal[]; // Omit for notes-only mode

  // Selection
  selectedNoteIds?: Set<string>;
  selectedJournalIds?: Set<string>;

  // Callback
  onConfirm: (selection: NotePickerSelection) => void;

  // Configuration
  mode: 'full' | 'notes-only'; // 'full' = journals + notes tabs
  variant: 'default' | 'compact'; // 'compact' = smaller modal

  // Features
  enableSearch?: boolean;
  enableShiftSelect?: boolean;
  showAddedBadge?: boolean;
}

type TabType = 'journals' | 'notes';

export function NotePickerModal({
  isOpen,
  onClose,
  noteTree,
  notes,
  journals = [],
  selectedNoteIds = new Set(),
  selectedJournalIds = new Set(),
  onConfirm,
  mode,
  variant,
  enableSearch = false,
  enableShiftSelect = false,
  showAddedBadge = true,
}: NotePickerModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('journals');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Track previous isOpen state to detect when modal opens
  const prevIsOpenRef = useRef(isOpen);

  // Initialize state when modal opens (transitions from closed to open)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Initialize selected items from the props
      const initialSelected = new Set<string>();
      selectedNoteIds.forEach((id) => initialSelected.add(id));
      if (mode === 'full') {
        selectedJournalIds.forEach((id) => initialSelected.add(id));
      }
      setSelectedItems(initialSelected);
      setExpandedNodeIds(new Set());
      setSearchQuery('');
      if (mode === 'full') {
        setActiveTab('journals');
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, mode, selectedNoteIds, selectedJournalIds]);

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

  // Toggle node expand/collapse
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

  // Shift+click selection for notes
  const handleToggleNote = useNoteTreeSelection(
    noteTree,
    selectedItems,
    setSelectedItems,
    selectedNoteIds
  );

  // Simple toggle for journals (no shift+select)
  const handleToggleJournal = useCallback((id: string, _shiftKey: boolean) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Filter notes by search query
  const filteredTree = useMemo(() => {
    return filterTreeBySearch(noteTree, searchQuery);
  }, [noteTree, searchQuery]);

  // Handle confirm
  const handleConfirm = () => {
    const orderedNotes = flattenNoteTree(noteTree);
    const selectedNotes: NotePickerSelection['notes'] = [];
    const selectedJournals: NotePickerSelection['journals'] = [];
    const contextItems: ContextItem[] = [];

    // Add journals first (in their original order)
    if (mode === 'full') {
      journals.forEach((journal) => {
        if (selectedItems.has(journal.id)) {
          selectedJournals.push({
            id: journal.id,
            title: journal.title,
            content: journal.notes ?? undefined,
            date: toISOString(journal.createdAt),
          });
          contextItems.push({
            type: 'journal',
            id: journal.id,
            title: journal.title,
            content: journal.notes ?? undefined,
            date: toISOString(journal.createdAt),
          });
        }
      });
    }

    // Add notes in tree order (parents before children)
    orderedNotes.forEach((note) => {
      if (selectedItems.has(note.id)) {
        selectedNotes.push({
          id: note.id,
          title: note.title,
          content: note.content ?? undefined,
          date: toISOString(note.updatedAt),
        });
        contextItems.push({
          type: 'note',
          id: note.id,
          title: note.title,
          content: note.content ?? undefined,
          date: toISOString(note.updatedAt),
        });
      }
    });

    const selection: NotePickerSelection = {
      notes: selectedNotes,
      noteIds: selectedNotes.map((n) => n.id),
      contextItems,
    };

    if (mode === 'full') {
      selection.journals = selectedJournals;
      selection.journalIds = selectedJournals.map((j) => j.id);
    }

    onConfirm(selection);
    onClose();
  };

  // Count selected items
  const selectedCount = selectedItems.size;

  // Determine modal size classes based on variant
  const modalClasses =
    variant === 'compact'
      ? 'w-full max-w-sm max-h-[60vh]'
      : 'w-full h-full md:max-w-4xl md:max-h-[90vh]';

  if (!isOpen) return null;

  // Compact variant - notes only, minimal UI
  if (variant === 'compact') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className={`bg-white dark:bg-dark-800 rounded-lg shadow-xl ${modalClasses} flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-dark-600">
            <h3 className="text-sm font-medium text-text-default dark:text-text-dark-default">
              Select Notes
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Note List */}
          <div className="flex-1 overflow-y-auto p-2">
            {notes.length === 0 ? (
              <div className="text-center py-4 text-text-secondary dark:text-text-dark-secondary text-sm">
                No notes available
              </div>
            ) : (
              <NestedNoteList
                nodes={noteTree}
                level={0}
                expandedNodeIds={expandedNodeIds}
                selectedIds={selectedItems}
                disabledIds={showAddedBadge ? selectedNoteIds : undefined}
                onToggleNode={toggleNode}
                onToggleItem={handleToggleNote}
                variant="compact"
                showDate={false}
                showPreview={false}
                showChildCount={false}
                showAddedBadge={showAddedBadge}
                enableShiftSelect={false}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 dark:border-dark-600">
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {selectedCount} selected
            </span>
            <div className="flex gap-2">
              {selectedCount > 0 && (
                <button
                  onClick={() => setSelectedItems(new Set())}
                  className="text-xs px-2 py-1 border border-neutral-200 dark:border-dark-600 rounded hover:bg-neutral-100 dark:hover:bg-dark-700"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary-hover"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant - full-featured modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 md:p-8">
      <div className={`bg-white dark:bg-dark-800 rounded-xl shadow-xl ${modalClasses} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-600">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-dark-100">
              Add Context
            </h2>
            {mode === 'full' && enableShiftSelect && (
              <p className="text-sm text-neutral-500 dark:text-dark-400 mt-1">
                Select journals and notes to include as context. Shift+click a parent note to
                select all children.
              </p>
            )}
            {mode === 'notes-only' && (
              <p className="text-sm text-neutral-500 dark:text-dark-400 mt-1">
                Select notes to include.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-dark-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs (only in full mode) */}
        {mode === 'full' && (
          <div className="flex border-b border-neutral-200 dark:border-dark-600">
            <button
              onClick={() => setActiveTab('journals')}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'journals'
                  ? 'text-primary border-b-2 border-primary bg-primary-50/50 dark:bg-primary-900/10'
                  : 'text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100'
              }`}
            >
              <ThemeIcon name="recording" alt="" size={22} />
              Journals ({journals.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'notes'
                  ? 'text-primary border-b-2 border-primary bg-primary-50/50 dark:bg-primary-900/10'
                  : 'text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100'
              }`}
            >
              <ThemeIcon name="note" alt="" size={22} />
              Notes ({notes.length})
            </button>
          </div>
        )}

        {/* Search (only when enabled) */}
        {enableSearch && mode === 'notes-only' && (
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
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'full' && activeTab === 'journals' && (
            <div className="space-y-2">
              {journals.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-dark-500">
                  <p>No journals found</p>
                </div>
              ) : (
                journals.map((journal) => {
                  const isSelected = selectedItems.has(journal.id) || selectedJournalIds.has(journal.id);
                  const isAlreadySelected = selectedJournalIds.has(journal.id);

                  return (
                    <div
                      key={journal.id}
                      onClick={() => !isAlreadySelected && handleToggleJournal(journal.id, false)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                      } ${isAlreadySelected ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-neutral-300 dark:border-dark-500'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-dark-100 truncate">
                            {journal.title}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-dark-400">
                            {formatDate(journal.createdAt)}
                          </p>
                          {journal.notes && (
                            <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1 line-clamp-2">
                              {journal.notes}
                            </p>
                          )}
                        </div>

                        {showAddedBadge && isAlreadySelected && (
                          <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                            Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {(mode === 'notes-only' || (mode === 'full' && activeTab === 'notes')) && (
            <div className="space-y-2">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-dark-500">
                  <p>{searchQuery ? 'No notes match your search.' : 'No notes found'}</p>
                </div>
              ) : (
                <NestedNoteList
                  nodes={enableSearch ? filteredTree : noteTree}
                  level={0}
                  expandedNodeIds={expandedNodeIds}
                  selectedIds={selectedItems}
                  disabledIds={showAddedBadge ? selectedNoteIds : undefined}
                  onToggleNode={toggleNode}
                  onToggleItem={handleToggleNote}
                  variant="full"
                  showDate={true}
                  showPreview={true}
                  showChildCount={true}
                  showAddedBadge={showAddedBadge}
                  enableShiftSelect={enableShiftSelect}
                  noteTree={noteTree}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-dark-600">
          <p className="text-sm text-neutral-500 dark:text-dark-400">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-700 dark:text-dark-300 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {mode === 'full' ? 'Add Selected' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
