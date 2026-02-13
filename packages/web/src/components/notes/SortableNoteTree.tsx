import { useNavigate } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import { useNavigationContext } from '../../contexts/NavigationContext';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragMoveEvent, closestCenter, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import NoteTreeNode from './NoteTreeNode';
import { NoteCreateForm } from './NoteCreateForm';
import type { NoteTreeNode as NoteTreeNodeType } from '../../hooks/useNotes';

interface SortableNoteTreeProps {
  isCollapsed?: boolean;
}

interface SortableNoteProps {
  node: NoteTreeNodeType;
  level: number;
  draggedOverNodeId: string | null;
  makeChildZone: boolean;
}

function SortableNote({ node, level, draggedOverNodeId, makeChildZone }: SortableNoteProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({ id: node.note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Split drag handle props
  const dragHandleProps = {
    ...attributes,
    ...listeners,
    ref: setActivatorNodeRef,
  };

  return (
    <div ref={setNodeRef} style={style} data-draggable-id={node.note.id}>
      <NoteTreeNode
        nodeId={node.note.id}
        level={level}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        isDragOver={draggedOverNodeId === node.note.id}
        makeChildZone={makeChildZone}
      />
    </div>
  );
}

interface DroppableNoteProps {
  node: NoteTreeNodeType;
  level: number;
  draggedOverNodeId: string | null;
  makeChildZone: boolean;
}

function DroppableNote({ node, level, draggedOverNodeId, makeChildZone }: DroppableNoteProps) {
  const { setNodeRef } = useDroppable({
    id: node.note.id,
  });

  return (
    <div ref={setNodeRef}>
      <SortableNote node={node} level={level} draggedOverNodeId={draggedOverNodeId} makeChildZone={makeChildZone} />
    </div>
  );
}

interface NestedSortableNotesProps {
  nodes: NoteTreeNodeType[];
  level: number;
  parentId: string | null;
  draggedOverNodeId: string | null;
  makeChildZone: boolean;
}

function NestedSortableNotes({ nodes, level, draggedOverNodeId, makeChildZone }: NestedSortableNotesProps) {
  const { expandedNodeIds } = useNotesContext();

  // Get all note IDs at this level for SortableContext
  const noteIds = nodes.map(node => node.note.id);

  return (
    <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
      {nodes.map(node => {
        const isExpanded = expandedNodeIds.has(node.note.id);

        return (
          <div key={node.note.id}>
            <DroppableNote node={node} level={level} draggedOverNodeId={draggedOverNodeId} makeChildZone={makeChildZone} />

            {/* Recursively render children if expanded */}
            {isExpanded && node.children.length > 0 && (
              <div style={{ marginLeft: '0px' }}>
                <NestedSortableNotes
                  nodes={node.children}
                  level={level + 1}
                  parentId={node.note.id}
                  draggedOverNodeId={draggedOverNodeId}
                  makeChildZone={makeChildZone}
                />
              </div>
            )}
          </div>
        );
      })}
    </SortableContext>
  );
}

export function NoteTree({ isCollapsed = false }: SortableNoteTreeProps) {
  const navigate = useNavigate();
  const { navigateWithWarning } = useNavigationContext();
  const { notes, isLoading, error, isCreating, startCreating, creatingParentId, reorderNotes } = useNotesContext();

  // Track drag position for detecting ON vs NEXT TO drops
  const [dragPosition, setDragPosition] = useState<{ overId: string; makeChild: boolean } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging
      },
    })
  );

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Get the collision rects from the droppable nodes
    // In @dnd-kit, we need to access rects differently
    const activeNodeRect = document.querySelector(`[data-draggable-id="${activeId}"]`)?.getBoundingClientRect();
    const overNodeRect = document.querySelector(`[data-draggable-id="${overId}"]`)?.getBoundingClientRect();

    if (!activeNodeRect || !overNodeRect) return;

    // Calculate vertical position to determine if dropping ON (child) or NEXT TO (sibling)
    const overCenterY = overNodeRect.top + overNodeRect.height / 2;
    const activeCenterY = activeNodeRect.top + activeNodeRect.height / 2;
    const dropPosition = activeCenterY - overCenterY;
    const threshold = overNodeRect.height * 0.7; // 70% threshold for making it a child (easier to trigger)

    const makeChild = Math.abs(dropPosition) < threshold;
    setDragPosition({ overId, makeChild });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset drag position
    setDragPosition(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    console.log('DragEnd:', { activeId, overId, dragPosition });

    // Use tracked drag position to determine intent
    const makeChild = dragPosition?.overId === overId && dragPosition.makeChild;

    console.log('makeChild:', makeChild);

    // Helper function to find a note and its parent in the tree
    const findNoteAndParent = (
      nodes: NoteTreeNodeType[],
      targetId: string,
      parent: NoteTreeNodeType | null = null
    ): { note: NoteTreeNodeType; parent: NoteTreeNodeType | null; siblings: NoteTreeNodeType[] } | null => {
      for (const node of nodes) {
        if (node.note.id === targetId) {
          return { note: node, parent, siblings: nodes };
        }
        if (node.children.length > 0) {
          const result = findNoteAndParent(node.children, targetId, node);
          if (result) return result;
        }
      }
      return null;
    };

    // Find both the active and over notes
    const activeResult = findNoteAndParent(notes, activeId);
    const overResult = findNoteAndParent(notes, overId);

    if (!activeResult || !overResult) {
      return;
    }

    const { note: activeNote, parent: activeParent, siblings: activeSiblings } = activeResult;
    const { note: overNote, parent: overParent, siblings: overSiblings } = overResult;

    // Check if the over note is a descendant of the active note (would create a cycle)
    const isDescendant = (node: NoteTreeNodeType, targetId: string): boolean => {
      if (node.note.id === targetId) return true;
      for (const child of node.children) {
        if (isDescendant(child, targetId)) return true;
      }
      return false;
    };

    if (isDescendant(activeNote, overId)) {
      // Cannot drop a parent onto its own child - would create a cycle
      return;
    }

    // Check if we're dropping on the same parent (making child vs making sibling at different level)
    // Notes are considered to have the same parent if:
    // 1. Both are root level (null parents), OR
    // 2. Both have the same non-null parent
    const sameParent = (!activeParent && !overParent) || activeParent?.note.id === overParent?.note.id;

    if (sameParent) {
      // Same parent - use position to decide: reorder (sibling) or make child
      if (makeChild) {
        // Make active a child of over note
        // Remove active from its current siblings
        const newActiveSiblings = [...activeSiblings];
        const activeIndex = newActiveSiblings.findIndex(n => n.note.id === activeId);
        newActiveSiblings.splice(activeIndex, 1);

        // Use a Map to ensure each note only gets one update
        const updatesMap = new Map<string, { id: string; position: number; parentId?: string | null }>();

        // Update positions for all old siblings (compact them)
        newActiveSiblings.forEach((node, index) => {
          updatesMap.set(node.note.id, { id: node.note.id, position: index });
        });

        // Make active a child of over note
        updatesMap.set(activeId, {
          id: activeId,
          position: overNote.children.length,
          parentId: overId,
        });

        await reorderNotes(Array.from(updatesMap.values()));
      } else {
        // Reorder as siblings at the same level
        const oldIndex = activeSiblings.findIndex(n => n.note.id === activeId);
        const newIndex = overSiblings.findIndex(n => n.note.id === overId);

        if (oldIndex === newIndex) {
          return; // No change needed
        }

        // Create new array with reordered items
        const newSiblings = [...activeSiblings];
        const [movedItem] = newSiblings.splice(oldIndex, 1);
        newSiblings.splice(newIndex, 0, movedItem);

        // Get the parentId for these siblings (null for root level, otherwise the parent's ID)
        const parentId = activeParent?.note.id ?? null;

        // Update positions for all affected siblings with explicit parentId
        const notesToReorder = newSiblings.map((node, index) => ({
          id: node.note.id,
          position: index,
          parentId,
        }));

        await reorderNotes(notesToReorder);
      }
    } else {
      // Different parents - use drag position to decide: make child or make sibling
      if (makeChild) {
        // Make active a child of over note
        // Remove active from its current siblings
        const newActiveSiblings = [...activeSiblings];
        const activeIndex = newActiveSiblings.findIndex(n => n.note.id === activeId);
        newActiveSiblings.splice(activeIndex, 1);

        // Use a Map to ensure each note only gets one update
        const updatesMap = new Map<string, { id: string; position: number; parentId?: string | null }>();

        // Update positions for all old siblings (compact them)
        newActiveSiblings.forEach((node, index) => {
          updatesMap.set(node.note.id, { id: node.note.id, position: index });
        });

        // Make active a child of over note
        updatesMap.set(activeId, {
          id: activeId,
          position: overNote.children.length,
          parentId: overId,
        });

        await reorderNotes(Array.from(updatesMap.values()));
      } else {
        // Make active a sibling of over note (in over's parent)
        const targetParentId = overParent?.note.id ?? null;
        const targetIndex = overSiblings.findIndex(n => n.note.id === overId);

        // Remove active from its current siblings
        const newActiveSiblings = [...activeSiblings];
        const activeIndex = newActiveSiblings.findIndex(n => n.note.id === activeId);
        newActiveSiblings.splice(activeIndex, 1);

        // Insert active into over's parent's children at target's position
        const newOverSiblings = [...overSiblings];
        newOverSiblings.splice(targetIndex, 0, activeNote);

        // Use a Map to ensure each note only gets one update
        const updatesMap = new Map<string, { id: string; position: number; parentId?: string | null }>();

        // Update positions for all old siblings (compact them)
        newActiveSiblings.forEach((node, index) => {
          updatesMap.set(node.note.id, { id: node.note.id, position: index });
        });

        // Update positions for ALL new siblings with correct parent
        newOverSiblings.forEach((node, index) => {
          updatesMap.set(node.note.id, {
            id: node.note.id,
            position: index,
            parentId: targetParentId,
          });
        });

        await reorderNotes(Array.from(updatesMap.values()));
      }
    }
  };

  const handleBackToNavigation = () => {
    navigateWithWarning(() => {
      navigate('/dashboard');
    });
  };

  const handleNewNote = () => {
    startCreating(null); // null = root note
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-800">
      {/* Header */}
      <div className={`border-b border-neutral-200 dark:border-dark-600 ${isCollapsed ? 'px-2 py-4' : 'p-4'}`}>
        {!isCollapsed && (
          <button
            onClick={handleBackToNavigation}
            className="flex items-center gap-2 text-sm text-neutral-500 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-50 transition-colors mb-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Navigation
          </button>
        )}

        <button
          onClick={handleNewNote}
          className={`flex items-center gap-2 bg-primary-500 text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-600 ${
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
      <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-2' : ''}`}>
        {isLoading && (
          <div className="p-4 text-center text-neutral-500 dark:text-dark-400">
            Loading notes...
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-error">
            Error: {error.message}
          </div>
        )}

        {!isLoading && !error && notes.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-neutral-500 dark:text-dark-400 mb-4">
              No notes yet
            </p>
            <p className="text-sm text-neutral-400 dark:text-dark-500">
              Click "New Note" to create your first note
            </p>
          </div>
        )}

        {!isLoading && !error && notes.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <NestedSortableNotes
              nodes={notes}
              level={0}
              parentId={null}
              draggedOverNodeId={dragPosition?.overId ?? null}
              makeChildZone={dragPosition?.makeChild ?? false}
            />
          </DndContext>
        )}

        {/* Create form for root notes */}
        {isCreating && creatingParentId === null && (
          <div className="px-4 py-2">
            <NoteCreateForm parentId={null} />
          </div>
        )}
      </div>

      {/* Manage Templates Button - Fixed at bottom */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-dark-600">
        <button
          onClick={() => navigate('/notes/templates')}
          className="flex items-center gap-2 text-sm text-neutral-600 dark:text-dark-300 hover:text-neutral-900 dark:hover:text-dark-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Manage Templates
        </button>
      </div>
    </div>
  );
}
