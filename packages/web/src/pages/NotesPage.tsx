import { useNotesContext } from '../contexts/NotesContext';
import { NoteEditorPanel } from '../components/notes/NoteEditorPanel';

export function NotesPage() {
  const { selectedNoteId } = useNotesContext();

  return (
    <div className="flex h-full">
      {/* NoteTree sidebar is rendered by AppLayout via Sidebar transformation */}
      {/* Editor panel in main area */}
      {selectedNoteId ? (
        <div className="flex-1">
          <NoteEditorPanel />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-text-default dark:text-text-dark-default mb-2">
              No note selected
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-6">
              Select a note from the sidebar or create a new one to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
