import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';

interface RecordingNotePanelProps {
  selectedNoteIds: string[];
  onSelectionChange: (noteIds: string[]) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function RecordingNotePanel({
  selectedNoteIds,
  onSelectionChange,
  isCollapsed = false,
  onToggleCollapse,
}: RecordingNotePanelProps) {
  const { notes } = useNotes();
  const [showSelector, setShowSelector] = useState(false);

  // Get selected note objects
  const selectedNotes = notes.filter((note) => selectedNoteIds.includes(note.id));

  if (isCollapsed) {
    return (
      <>
        <button
          onClick={onToggleCollapse}
          className="fixed bottom-4 left-4 z-40 bg-white dark:bg-dark-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="text-sm font-medium text-text-default dark:text-text-dark-default">
            {selectedNotes.length} Notes
          </span>
        </button>

        {showSelector && (
          <RecordingNoteSelector
            isOpen={showSelector}
            onClose={() => setShowSelector(false)}
            selectedNoteIds={selectedNoteIds}
            onSelectionChange={onSelectionChange}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md">
        <div className="bg-white dark:bg-dark-800 shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-dark-600">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="text-sm font-medium text-text-default dark:text-text-dark-default">
                Linked Notes ({selectedNotes.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSelector(true)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded transition-colors"
                title="Edit selection"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded transition-colors"
                title="Collapse"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Note List */}
          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
            {selectedNotes.length === 0 ? (
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary text-center py-4">
                No notes selected. Click edit to add notes.
              </p>
            ) : (
              selectedNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 p-2 bg-neutral-50 dark:bg-dark-700 rounded text-sm"
                  style={{ borderLeft: `2px solid ${note.color || '#94a3b8'}` }}
                >
                  <span className="text-base flex-shrink-0">{note.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-default dark:text-text-dark-default truncate">
                      {note.title}
                    </p>
                    {note.content && (
                      <p className="text-xs text-text-secondary dark:text-text-dark-secondary line-clamp-2">
                        {note.content}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onSelectionChange(selectedNoteIds.filter((id) => id !== note.id))}
                    className="flex-shrink-0 p-1 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded"
                    title="Remove note"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSelector && (
        <RecordingNoteSelector
          isOpen={showSelector}
          onClose={() => setShowSelector(false)}
          selectedNoteIds={selectedNoteIds}
          onSelectionChange={onSelectionChange}
        />
      )}
    </>
  );
}

// Simplified selector for recording mode (more compact)
interface RecordingNoteSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNoteIds: string[];
  onSelectionChange: (noteIds: string[]) => void;
}

function RecordingNoteSelector({
  isOpen,
  onClose,
  selectedNoteIds,
  onSelectionChange,
}: RecordingNoteSelectorProps) {
  const { noteTree, isLoading } = useNotes();
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Toggle expand/collapse
  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Toggle note selection
  const toggleNote = (noteId: string) => {
    if (selectedNoteIds.includes(noteId)) {
      onSelectionChange(selectedNoteIds.filter((id) => id !== noteId));
    } else {
      onSelectionChange([...selectedNoteIds, noteId]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-sm max-h-[60vh] flex flex-col">
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
          {isLoading ? (
            <div className="text-center py-4 text-text-secondary dark:text-text-dark-secondary text-sm">
              Loading...
            </div>
          ) : noteTree.length === 0 ? (
            <div className="text-center py-4 text-text-secondary dark:text-text-dark-secondary text-sm">
              No notes available
            </div>
          ) : (
            <NestedNoteList
              nodes={noteTree}
              level={0}
              expandedNodeIds={expandedNodeIds}
              selectedNoteIds={selectedNoteIds}
              onToggleNode={toggleNode}
              onToggleNote={toggleNote}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 dark:border-dark-600">
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {selectedNoteIds.length} selected
          </span>
          <div className="flex gap-2">
            {selectedNoteIds.length > 0 && (
              <button
                onClick={() => onSelectionChange([])}
                className="text-xs px-2 py-1 border border-neutral-200 dark:border-dark-600 rounded hover:bg-neutral-100 dark:hover:bg-dark-700"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
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

interface NestedNoteListProps {
  nodes: typeof noteTree;
  level: number;
  expandedNodeIds: Set<string>;
  selectedNoteIds: string[];
  onToggleNode: (nodeId: string) => void;
  onToggleNote: (noteId: string) => void;
}

function NestedNoteList({
  nodes,
  level,
  expandedNodeIds,
  selectedNoteIds,
  onToggleNode,
  onToggleNote,
}: NestedNoteListProps) {
  return (
    <>
      {nodes.map((node) => {
        const isSelected = selectedNoteIds.includes(node.note.id);
        const isExpanded = expandedNodeIds.has(node.note.id);
        const hasChildren = node.children.length > 0;

        return (
          <div key={node.note.id}>
            <div
              className="flex items-center gap-1.5 py-1.5 px-1 rounded hover:bg-neutral-100 dark:hover:bg-dark-700 cursor-pointer"
              style={{ paddingLeft: `${level * 12 + 4}px` }}
              onClick={() => onToggleNote(node.note.id)}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNode(node.note.id);
                  }}
                  className="p-0.5 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded flex-shrink-0"
                >
                  <svg
                    width="10"
                    height="10"
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
                <span className="w-4 flex-shrink-0" />
              )}

              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleNote(node.note.id)}
                className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-dark-600 text-primary focus:ring-primary-500 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              />

              <span className="text-sm flex-shrink-0">{node.note.icon}</span>
              <span className="text-xs truncate">{node.note.title}</span>
            </div>

            {hasChildren && isExpanded && (
              <NestedNoteList
                nodes={node.children}
                level={level + 1}
                expandedNodeIds={expandedNodeIds}
                selectedNoteIds={selectedNoteIds}
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
