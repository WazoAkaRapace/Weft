import type { NoteTreeNode } from './noteTreeUtils';
import { formatDate } from './noteTreeUtils';

export interface NestedNoteListProps {
  nodes: NoteTreeNode[];
  level: number;
  expandedNodeIds: Set<string>;
  selectedIds: Set<string>;
  disabledIds?: Set<string>;
  onToggleNode: (nodeId: string) => void;
  onToggleItem: (id: string, shiftKey: boolean) => void;

  // Visual configuration
  variant: 'full' | 'compact';

  // Optional features
  showDate?: boolean;
  showPreview?: boolean;
  showChildCount?: boolean;
  showAddedBadge?: boolean;
  enableShiftSelect?: boolean;

  // For shift+click child selection
  noteTree?: NoteTreeNode[];
}

export function NestedNoteList({
  nodes,
  level,
  expandedNodeIds,
  selectedIds,
  disabledIds = new Set(),
  onToggleNode,
  onToggleItem,
  variant,
  showDate = true,
  showPreview = true,
  showChildCount = true,
  showAddedBadge = true,
  enableShiftSelect = false,
  noteTree,
}: NestedNoteListProps) {
  // Calculate indentation based on variant
  const indentPerLevel = variant === 'compact' ? 12 : 20;
  const basePadding = variant === 'compact' ? 4 : 12;
  const leftPadding = level * indentPerLevel + basePadding;

  return (
    <>
      {nodes.map((node) => {
        const isSelected = selectedIds.has(node.note.id);
        const isDisabled = disabledIds.has(node.note.id);
        const isExpanded = expandedNodeIds.has(node.note.id);
        const hasChildren = node.children.length > 0;

        // Handle click with optional shift-select
        const handleClick = (e: React.MouseEvent) => {
          if (isDisabled) return;
          onToggleItem(node.note.id, enableShiftSelect && e.shiftKey);
        };

        // Compact variant styling
        if (variant === 'compact') {
          return (
            <div key={node.note.id}>
              <div
                className="flex items-center gap-1.5 py-1.5 px-1 rounded hover:bg-neutral-100 dark:hover:bg-dark-700 cursor-pointer"
                style={{ paddingLeft: `${leftPadding}px` }}
                onClick={handleClick}
              >
                {/* Expand/Collapse Chevron */}
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

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !isDisabled && onToggleItem(node.note.id, false)}
                  disabled={isDisabled}
                  className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-dark-600 text-primary focus:ring-primary-500 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Icon */}
                <span className="text-sm flex-shrink-0">{node.note.icon}</span>

                {/* Title */}
                <span className="text-xs truncate">{node.note.title}</span>

                {/* Added badge */}
                {showAddedBadge && isDisabled && (
                  <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded ml-auto">
                    Added
                  </span>
                )}
              </div>

              {/* Children */}
              {hasChildren && isExpanded && (
                <NestedNoteList
                  nodes={node.children}
                  level={level + 1}
                  expandedNodeIds={expandedNodeIds}
                  selectedIds={selectedIds}
                  disabledIds={disabledIds}
                  onToggleNode={onToggleNode}
                  onToggleItem={onToggleItem}
                  variant={variant}
                  showDate={showDate}
                  showPreview={showPreview}
                  showChildCount={showChildCount}
                  showAddedBadge={showAddedBadge}
                  enableShiftSelect={enableShiftSelect}
                  noteTree={noteTree}
                />
              )}
            </div>
          );
        }

        // Full variant styling (like ContextPickerModal)
        return (
          <div key={node.note.id}>
            <div
              className={`flex items-center gap-2 py-3 px-3 rounded-lg border-2 transition-colors ${
                isDisabled
                  ? 'opacity-60 cursor-not-allowed border-neutral-200 dark:border-dark-600'
                  : 'cursor-pointer hover:border-neutral-300 dark:hover:border-dark-500'
              } ${
                isSelected
                  ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                  : 'border-neutral-200 dark:border-dark-600'
              }`}
              style={{ paddingLeft: `${leftPadding}px` }}
              onClick={handleClick}
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

              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-neutral-300 dark:border-dark-500'
                }`}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              {/* Note Icon & Title */}
              <span className="text-lg flex-shrink-0">{node.note.icon}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium text-neutral-900 dark:text-dark-100 truncate"
                  title={
                    enableShiftSelect && hasChildren
                      ? `Shift+click to select all children`
                      : undefined
                  }
                >
                  {node.note.title}
                  {showChildCount && hasChildren && (
                    <span className="ml-2 text-xs text-neutral-400 dark:text-dark-500 font-normal">
                      ({node.children.length}{' '}
                      {node.children.length === 1 ? 'child' : 'children'})
                    </span>
                  )}
                </p>
                {showDate && node.note.updatedAt && (
                  <p className="text-sm text-neutral-500 dark:text-dark-400">
                    {formatDate(node.note.updatedAt)}
                  </p>
                )}
              </div>

              {/* Added badge */}
              {showAddedBadge && isDisabled && (
                <span className="text-xs bg-primary text-white px-2 py-1 rounded">Added</span>
              )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <NestedNoteList
                nodes={node.children}
                level={level + 1}
                expandedNodeIds={expandedNodeIds}
                selectedIds={selectedIds}
                disabledIds={disabledIds}
                onToggleNode={onToggleNode}
                onToggleItem={onToggleItem}
                variant={variant}
                showDate={showDate}
                showPreview={showPreview}
                showChildCount={showChildCount}
                showAddedBadge={showAddedBadge}
                enableShiftSelect={enableShiftSelect}
                noteTree={noteTree}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
