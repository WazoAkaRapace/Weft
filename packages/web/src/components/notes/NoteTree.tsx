import { useNavigate } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import NoteTreeNode from './NoteTreeNode';
import { NoteCreateForm } from './NoteCreateForm';

interface NoteTreeProps {
  isCollapsed?: boolean;
}

export function NoteTree({ isCollapsed = false }: NoteTreeProps) {
  const navigate = useNavigate();
  const { notes, isLoading, error, isCreating, startCreating, creatingParentId } = useNotesContext();

  const handleBackToNavigation = () => {
    navigate('/dashboard');
  };

  const handleNewNote = () => {
    startCreating(null); // null = root note
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-background-card-dark">
      {/* Header */}
      <div className={`border-b border-border dark:border-border-dark ${isCollapsed ? 'px-2 py-4' : 'p-4'}`}>
        {!isCollapsed && (
          <button
            onClick={handleBackToNavigation}
            className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-dark-secondary hover:text-text-default dark:hover:text-text-dark-default transition-colors mb-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Navigation
          </button>
        )}

        <button
          onClick={handleNewNote}
          className={`flex items-center gap-2 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover ${
            isCollapsed ? 'px-2 py-2' : 'px-4 py-2 w-full'
          }`}
          title={isCollapsed ? 'New Note' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {!isCollapsed && <span>New Note</span>}
        </button>
      </div>

      {/* Tree Content */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : ''}`}>
        {isLoading && (
          <div className="p-4 text-center text-text-secondary dark:text-text-dark-secondary">
            Loading notes...
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-danger">
            Error: {error.message}
          </div>
        )}

        {!isLoading && !error && notes.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-text-secondary dark:text-text-dark-secondary mb-4">
              No notes yet
            </p>
            <p className="text-sm text-text-hint dark:text-text-dark-hint">
              Click "New Note" to create your first note
            </p>
          </div>
        )}

        {!isLoading && !error && notes.map(rootNode => (
          <NoteTreeNode key={rootNode.note.id} nodeId={rootNode.note.id} level={0} />
        ))}

        {/* Create form for root notes */}
        {isCreating && creatingParentId === null && (
          <div className="px-4 py-2">
            <NoteCreateForm parentId={null} />
          </div>
        )}
      </div>
    </div>
  );
}
