import { useState } from 'react';
import type { ContextItem } from '../../hooks/useAIChat';
import { useJournals } from '../../hooks/useJournals';
import { useNotes } from '../../hooks/useNotes';
import { ContextPickerModal } from './ContextPickerModal';
import { ContextItemComponent } from './ContextItem';

interface ContextSelectorProps {
  selected: ContextItem[];
  onChange: (items: ContextItem[]) => void;
  onClose?: () => void;
}

export function ContextSelector({ selected, onChange, onClose }: ContextSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Fetch journals and notes for the picker
  const { journals } = useJournals({ limit: 20, page: 1 });
  const { notes, noteTree } = useNotes();

  const handleRemoveItem = (id: string) => {
    onChange(selected.filter(item => item.id !== id));
  };

  const handleAddItems = (items: ContextItem[]) => {
    // Merge new items with existing, avoiding duplicates
    const existingIds = new Set(selected.map(item => item.id));
    const newItems = items.filter(item => !existingIds.has(item.id));
    onChange([...selected, ...newItems]);
  };

  return (
    <>
      <div className="w-full h-full bg-white dark:bg-dark-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-dark-600 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-dark-100 flex items-center gap-2">
              <span>📎</span>
              <span>Context</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-dark-400 mt-1">
              Add journals or notes as context
            </p>
          </div>
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-dark-300 transition-colors"
              aria-label="Close context panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Add button */}
        <div className="p-4">
          <button
            onClick={() => setIsPickerOpen(true)}
            className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Context
          </button>
        </div>

        {/* Selected items */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {selected.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 dark:text-dark-500">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">No context selected</p>
              <p className="text-xs mt-1">Add items to help the AI understand your context better</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selected.map(item => (
                <ContextItemComponent
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        {selected.length > 0 && (
          <div className="p-4 border-t border-neutral-200 dark:border-dark-600">
            <p className="text-xs text-neutral-500 dark:text-dark-400">
              {selected.length} item{selected.length !== 1 ? 's' : ''} selected as context
            </p>
          </div>
        )}
      </div>

      {/* Context Picker Modal */}
      {isPickerOpen && (
        <ContextPickerModal
          journals={journals}
          notes={notes}
          noteTree={noteTree}
          selected={selected}
          onSelect={handleAddItems}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </>
  );
}
