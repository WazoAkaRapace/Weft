import { memo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import { useNavigationContext } from '../../contexts/NavigationContext';
import { NoteCreateForm } from './NoteCreateForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface NoteTreeNodeProps {
  nodeId: string;
  level: number;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isDragOver?: boolean;
  makeChildZone?: boolean;
}

function NoteTreeNode({ nodeId, level, dragHandleProps, isDragging = false, isDragOver = false, makeChildZone = false }: NoteTreeNodeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateWithWarning } = useNavigationContext();
  const {
    notes,
    selectedNoteId,
    expandedNodeIds,
    isCreating,
    creatingParentId,
    toggleNode,
    selectNote,
    startCreating,
    deleteNote,
  } = useNotesContext();

  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  // Find this node and its children
  const findNode = (nodes: typeof notes): typeof nodes[0] | null => {
    for (const node of nodes) {
      if (node.note.id === nodeId) return node;
      if (node.children.length > 0) {
        const found = findNode(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const node = findNode(notes);
  if (!node) return null;

  const isSelected = selectedNoteId === nodeId;
  const isExpanded = expandedNodeIds.has(nodeId);
  const hasChildren = node.children.length > 0;
  const isShowingCreateForm = isCreating && creatingParentId === nodeId;

  const handleClick = () => {
    // Don't show warning if clicking on the already-selected note
    if (selectedNoteId === nodeId) {
      selectNote(nodeId);
      return;
    }

    navigateWithWarning(() => {
      selectNote(nodeId);
      navigate(`/notes/${nodeId}`);
    });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNode(nodeId);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    startCreating(nodeId);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNote(nodeId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToDelete({ id: nodeId, title: node.note.title });
  };

  const confirmDelete = useCallback(async () => {
    if (!noteToDelete) return;

    // Check if the current URL is for this note (e.g., /notes/{nodeId})
    const isCurrentPage = location.pathname === `/notes/${noteToDelete.id}`;
    await deleteNote(noteToDelete.id);
    // Redirect to /notes if we deleted the note that's currently being viewed
    if (isCurrentPage) {
      navigate('/notes');
    }
    setNoteToDelete(null);
  }, [noteToDelete, deleteNote, location, navigate]);

  // Calculate indentation based on level
  const indent = level * 16; // 16px per level

  return (
    <>
      <div>
        {/* Node */}
        <div
          onClick={handleClick}
          className={`
            group relative flex items-center gap-2 py-2 pr-2 cursor-pointer transition-colors
            hover:bg-neutral-100 dark:hover:bg-dark-700
            ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500' : ''}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
          `}
          style={{
            paddingLeft: `${indent + 16}px`,
            backgroundColor: node.note.color ? `${node.note.color}10` : undefined
          }}
        >

          {/* Expand/Collapse Chevron */}
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className="p-0.5 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded transition-colors flex-shrink-0"
            >
              <svg
                width="16"
                height="16"
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

          {/* Note Icon */}
          <span className="text-lg flex-shrink-0">{node.note.icon}</span>

          {/* Note Title */}
          <span className="flex-1 truncate text-sm text-neutral-700 dark:text-dark-200">
            {node.note.title}
          </span>

          {/* Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
            {/* Add Child Button */}
            <button
              onClick={handleAddChild}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded transition-colors"
              title="Add child note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-error-light dark:hover:bg-error-dark-light/30 text-error rounded transition-colors"
              title="Delete note"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          {/* Drag Handle - absolutely positioned on left, appears on hover */}
          {dragHandleProps && (
            <div
              className="hidden group-hover:flex absolute left-0 top-1/2 -translate-y-1/2 bg-white dark:bg-dark-800 rounded-r-md shadow-sm"
              {...dragHandleProps}
              style={{ marginLeft: '-8px' }}
            >
              <div
                className="p-1.5 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded-r-md transition-colors cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </div>
            </div>
          )}

          {/* Drop Zone Indicator */}
          {isDragOver && makeChildZone && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-100 dark:bg-primary-900/40 rounded pointer-events-none z-10">
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-white dark:bg-dark-800 px-2 py-1 rounded shadow-sm">
                Drop as child
              </span>
            </div>
          )}
          {isDragOver && !makeChildZone && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-dark-600/40 rounded pointer-events-none z-10">
              <span className="text-xs font-medium text-neutral-700 dark:text-dark-300 bg-white dark:bg-dark-800 px-2 py-1 rounded shadow-sm">
                Reorder
              </span>
            </div>
          )}
        </div>

        {/* Create Form (if showing for this parent) */}
        {isShowingCreateForm && (
          <div className="py-2" style={{ paddingLeft: `${indent + 32}px` }}>
            <NoteCreateForm parentId={nodeId} />
          </div>
        )}
      </div>

      {noteToDelete && (
        <ConfirmDialog
          isOpen={!!noteToDelete}
          title="Delete Note"
          message={`Are you sure you want to delete "${noteToDelete.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setNoteToDelete(null)}
        />
      )}
    </>
  );
}

// Memo to prevent unnecessary re-renders
export default memo(NoteTreeNode);
