import { useNotesContext } from '../contexts/NotesContext';
import { useLayoutContext } from '../components/layout/AppLayout';
import { NoteEditorPanel } from '../components/notes/NoteEditorPanel';

export function NotesPage() {
  const { selectedNoteId } = useNotesContext();
  const { setSidebarOpen } = useLayoutContext();

  return (
    <div className="flex h-full">
      {/* NoteTree sidebar is rendered by AppLayout via Sidebar transformation */}
      {/* Editor panel in main area */}
      {selectedNoteId ? (
        <div className="flex-1">
          <NoteEditorPanel />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {/* Mobile burger button - only shown when no note is selected */}
          <button
            className="md:hidden fixed top-4 left-4 z-30 w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-background-card-dark border border-border dark:border-border-dark shadow hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>

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
