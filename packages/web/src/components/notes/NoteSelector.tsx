import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotes } from '../../hooks/useNotes';

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

  // Close handler that also resets search
  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  // Filter notes by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery) return noteTree;

    const query = searchQuery.toLowerCase();
    const filterNode = (node: typeof noteTree[0]): typeof noteTree[0] | null => {
      const matchesSearch = node.note.title.toLowerCase().includes(query) ||
        (node.note.content && node.note.content.toLowerCase().includes(query));

      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is typeof node => child !== null);

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    };

    return noteTree.map(filterNode).filter((node): node is typeof noteTree[0] => node !== null);
  }, [noteTree, searchQuery]);

  // Toggle expand/collapse
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodeIds(prev => {
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
  const toggleNote = useCallback((noteId: string) => {
    if (selectedNoteIds.includes(noteId)) {
      onSelectionChange(selectedNoteIds.filter(id => id !== noteId));
    } else {
      onSelectionChange([...selectedNoteIds, noteId]);
    }
  }, [selectedNoteIds, onSelectionChange]);

  // Count total notes (excluding excluded)
  const availableCount = useMemo(() => {
    const countNotes = (nodes: typeof noteTree): number => {
      let count = 0;
      for (const node of nodes) {
        if (!excludeIds.includes(node.note.id)) {
          count++;
        }
        count += countNotes(node.children);
      }
      return count;
    };
    return countNotes(noteTree);
  }, [noteTree, excludeIds]);

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
              selectedNoteIds={selectedNoteIds}
              excludeIds={excludeIds}
              onToggleNode={toggleNode}
              onToggleNote={toggleNote}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-200 dark:border-dark-600">
          <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {selectedNoteIds.length} selected
            {selectedNoteIds.length > 0 && ` of ${availableCount} available`}
          </span>
          <div className="flex gap-2">
            {selectedNoteIds.length > 0 && (
              <button
                onClick={() => onSelectionChange([])}
                className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleClose}
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

interface NestedNoteListProps {
  nodes: typeof noteTree;
  level: number;
  expandedNodeIds: Set<string>;
  selectedNoteIds: string[];
  excludeIds: string[];
  onToggleNode: (nodeId: string) => void;
  onToggleNote: (noteId: string) => void;
}

function NestedNoteList({
  nodes,
  level,
  expandedNodeIds,
  selectedNoteIds,
  excludeIds,
  onToggleNode,
  onToggleNote,
}: NestedNoteListProps) {
  return (
    <>
      {nodes.map(node => {
        const isExcluded = excludeIds.includes(node.note.id);
        const isSelected = selectedNoteIds.includes(node.note.id);
        const isExpanded = expandedNodeIds.has(node.note.id);
        const hasChildren = node.children.length > 0;

        return (
          <div key={node.note.id}>
            <div
              className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors ${
                isExcluded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => !isExcluded && onToggleNote(node.note.id)}
            >
              {/* Expand/Collapse Chevron */}
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNode(node.note.id);
                  }}
                  className="p-0.5 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded transition-colors flex-shrink-0"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ) : (
                <span className="w-5 flex-shrink-0" />
              )}

              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => !isExcluded && onToggleNote(node.note.id)}
                disabled={isExcluded}
                className="w-4 h-4 rounded border-neutral-300 dark:border-dark-600 text-primary focus:ring-primary-500 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Note Icon */}
              <span className="text-base flex-shrink-0">{node.note.icon}</span>

              {/* Note Title */}
              <span className={`flex-1 truncate text-sm ${
                isSelected
                  ? 'text-text-default dark:text-text-dark-default font-medium'
                  : 'text-text-secondary dark:text-text-dark-secondary'
              }`}>
                {node.note.title}
              </span>
            </div>

            {/* Render children if expanded */}
            {hasChildren && isExpanded && (
              <NestedNoteList
                nodes={node.children}
                level={level + 1}
                expandedNodeIds={expandedNodeIds}
                selectedNoteIds={selectedNoteIds}
                excludeIds={excludeIds}
                onToggleNode={onToggleNode}
                onToggleNote={onToggleNote}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
