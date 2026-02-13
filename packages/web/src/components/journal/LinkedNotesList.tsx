import { useState } from 'react';
import type { Note } from '@weft/shared';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface LinkedNotesListProps {
  journalId: string;
  notes: Note[];
  onUnlink: (noteId: string) => Promise<void>;
  onNoteClick: (note: Note) => void;
  isLoading?: boolean;
}

export function LinkedNotesList({
  notes,
  onUnlink,
  onNoteClick,
  isLoading = false,
}: LinkedNotesListProps) {
  const [noteToUnlink, setNoteToUnlink] = useState<Note | null>(null);

  const handleUnlink = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToUnlink(note);
  };

  const confirmUnlink = async () => {
    if (noteToUnlink) {
      await onUnlink(noteToUnlink.id);
      setNoteToUnlink(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-neutral-100 dark:bg-dark-700 rounded-lg h-16 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
        <p className="text-sm">No notes linked to this journal yet.</p>
        <p className="text-xs mt-1 text-text-hint dark:text-text-dark-hint">
          Click "+ Link Note" to add notes
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => onNoteClick(note)}
            onUnlink={handleUnlink}
          />
        ))}
      </div>

      {noteToUnlink && (
        <ConfirmDialog
          isOpen={!!noteToUnlink}
          title="Unlink Note"
          message={`Are you sure you want to unlink "${noteToUnlink.title}" from this journal?`}
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onConfirm={confirmUnlink}
          onCancel={() => setNoteToUnlink(null)}
        />
      )}
    </>
  );
}

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onUnlink: (note: Note, e: React.MouseEvent) => void;
}

function NoteCard({ note, onClick, onUnlink }: NoteCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-neutral-50 dark:bg-dark-700 rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
      style={{
        borderLeft: `3px solid ${note.color || '#94a3b8'}`,
      }}
    >
      {/* Note Icon and Title */}
      <div className="flex items-start gap-2">
        <span className="text-xl flex-shrink-0">{note.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-default dark:text-text-dark-default truncate">
            {note.title}
          </h4>
          {note.content && (
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary truncate mt-1">
              {note.content}
            </p>
          )}
        </div>
      </div>

      {/* Unlink Button - visible on hover */}
      <button
        onClick={(e) => onUnlink(note, e)}
        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-dark-800 rounded shadow-sm hover:bg-neutral-100 dark:hover:bg-dark-600"
        title="Unlink note"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-text-secondary dark:text-text-dark-secondary"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
