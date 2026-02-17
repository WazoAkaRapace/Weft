import { useState, useEffect } from 'react';
import { NotePickerModal, type NotePickerSelection } from '../notes/shared';
import { useNotesByIds } from '../../hooks/useNotesByIds';

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
  const [showSelector, setShowSelector] = useState(false);

  // Fetch full note content only for selected notes
  const { notes: selectedNotes, fetch: fetchSelectedNotes } = useNotesByIds();

  // Fetch selected notes when selection changes
  useEffect(() => {
    if (selectedNoteIds.length > 0) {
      fetchSelectedNotes(selectedNoteIds);
    }
  }, [selectedNoteIds, fetchSelectedNotes]);

  const handleConfirm = (selection: NotePickerSelection) => {
    onSelectionChange(selection.noteIds);
  };

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
            {selectedNoteIds.length} Notes
          </span>
        </button>

        <NotePickerModal
          isOpen={showSelector}
          onClose={() => setShowSelector(false)}
          selectedNoteIds={new Set(selectedNoteIds)}
          onConfirm={handleConfirm}
          mode="notes-only"
          variant="compact"
          showAddedBadge={false}
          lazyLoad={true}
        />
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
                Linked Notes ({selectedNoteIds.length})
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
            {selectedNoteIds.length === 0 ? (
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

      <NotePickerModal
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        selectedNoteIds={new Set(selectedNoteIds)}
        onConfirm={handleConfirm}
        mode="notes-only"
        variant="compact"
        showAddedBadge={false}
        lazyLoad={true}
      />
    </>
  );
}
