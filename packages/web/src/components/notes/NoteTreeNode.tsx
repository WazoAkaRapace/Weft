import { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import { NoteCreateForm } from './NoteCreateForm';

interface NoteTreeNodeProps {
  nodeId: string;
  level: number;
}

function NoteTreeNode({ nodeId, level }: NoteTreeNodeProps) {
  const navigate = useNavigate();
  const location = useLocation();
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
    getChildNotes,
  } = useNotesContext();

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
  const children = getChildNotes(nodeId);
  const isShowingCreateForm = isCreating && creatingParentId === nodeId;

  const handleClick = () => {
    selectNote(nodeId);
    navigate(`/notes/${nodeId}`);
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${node.note.title}"?`)) {
      // Check if the current URL is for this note (e.g., /notes/{nodeId})
      const isCurrentPage = location.pathname === `/notes/${nodeId}`;
      await deleteNote(nodeId);
      // Redirect to /notes if we deleted the note that's currently being viewed
      if (isCurrentPage) {
        navigate('/notes');
      }
    }
  };

  // Calculate indentation based on level
  const indent = level * 16; // 16px per level

  return (
    <div>
      {/* Node */}
      <div
        onClick={handleClick}
        className={`
          group flex items-center gap-2 py-2 pr-2 cursor-pointer transition-colors
          hover:bg-gray-100 dark:hover:bg-gray-800
          ${isSelected ? 'bg-primary-light dark:bg-primary/20 border-l-4 border-primary' : ''}
        `}
        style={{ paddingLeft: `${indent + 16}px` }}
      >
        {/* Expand/Collapse Chevron */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
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
        <span className="flex-1 truncate text-sm text-text-default dark:text-text-dark-default">
          {node.note.title}
        </span>

        {/* Hover Actions */}
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          {/* Add Child Button */}
          <button
            onClick={handleAddChild}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
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
            className="p-1 hover:bg-danger-light dark:hover:bg-danger/20 text-danger rounded transition-colors"
            title="Delete note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {(isExpanded || isShowingCreateForm) && children.length > 0 && (
        <div>
          {children.map(child => (
            <NoteTreeNode key={child.note.id} nodeId={child.note.id} level={level + 1} />
          ))}
        </div>
      )}

      {/* Create Form (if showing for this parent) */}
      {isShowingCreateForm && (
        <div className="py-2" style={{ paddingLeft: `${indent + 32}px` }}>
          <NoteCreateForm parentId={nodeId} />
        </div>
      )}
    </div>
  );
}

// Memo to prevent unnecessary re-renders
export default memo(NoteTreeNode);
