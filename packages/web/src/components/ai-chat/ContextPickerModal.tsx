import { useState } from 'react';
import type { ContextItem } from '../../hooks/useAIChat';
import type { Journal } from '@weft/shared';
import type { Note } from '@weft/shared';

interface ContextPickerModalProps {
  journals: Journal[];
  notes: Note[];
  selected: ContextItem[];
  onSelect: (items: ContextItem[]) => void;
  onClose: () => void;
}

type TabType = 'journals' | 'notes';

export function ContextPickerModal({
  journals,
  notes,
  selected,
  onSelect,
  onClose,
}: ContextPickerModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('journals');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const selectedIds = new Set(selected.map(item => item.id));

  const handleToggleItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toISOString = (date: Date | string | undefined | null): string | undefined => {
    if (!date) return undefined;

    if (typeof date === 'string') {
      // Already a string, return it if it's valid ISO format
      return date;
    }

    // It's a Date object
    try {
      return date.toISOString();
    } catch {
      return undefined;
    }
  };

  const handleAddSelected = () => {
    const itemsToAdd: ContextItem[] = [];

    selectedItems.forEach(id => {
      // Check journals
      const journal = journals.find(j => j.id === id);
      if (journal) {
        itemsToAdd.push({
          type: 'journal',
          id: journal.id,
          title: journal.title,
          content: journal.notes,
          date: toISOString(journal.createdAt),
        });
        return;
      }

      // Check notes
      const note = notes.find(n => n.id === id);
      if (note) {
        itemsToAdd.push({
          type: 'note',
          id: note.id,
          title: note.title,
          content: note.content,
          date: toISOString(note.updatedAt),
        });
      }
    });

    if (itemsToAdd.length > 0) {
      onSelect(itemsToAdd);
    }

    onClose();
  };

  const formatDate = (date: Date | string | undefined | null) => {
    if (!date) return '';

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return '';
      }

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(dateObj);
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-600">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-dark-100">
              Add Context
            </h2>
            <p className="text-sm text-neutral-500 dark:text-dark-400 mt-1">
              Select journals and notes to include as context
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-dark-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-dark-600">
          <button
            onClick={() => setActiveTab('journals')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'journals'
                ? 'text-primary border-b-2 border-primary bg-primary-50/50 dark:bg-primary-900/10'
                : 'text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100'
            }`}
          >
            📹 Journals ({journals.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'notes'
                ? 'text-primary border-b-2 border-primary bg-primary-50/50 dark:bg-primary-900/10'
                : 'text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100'
            }`}
          >
            📝 Notes ({notes.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'journals' && (
            <div className="space-y-2">
              {journals.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-dark-500">
                  <p>No journals found</p>
                </div>
              ) : (
                journals.map(journal => {
                  const isSelected = selectedItems.has(journal.id) || selectedIds.has(journal.id);
                  const isAlreadySelected = selectedIds.has(journal.id);

                  return (
                    <div
                      key={journal.id}
                      onClick={() => !isAlreadySelected && handleToggleItem(journal.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                      } ${isAlreadySelected ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-neutral-300 dark:border-dark-500'
                        }`}>
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-dark-100 truncate">
                            {journal.title}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-dark-400">
                            {formatDate(journal.createdAt)}
                          </p>
                          {journal.notes && (
                            <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1 line-clamp-2">
                              {journal.notes}
                            </p>
                          )}
                        </div>

                        {isAlreadySelected && (
                          <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                            Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-2">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-dark-500">
                  <p>No notes found</p>
                </div>
              ) : (
                notes.map(note => {
                  const isSelected = selectedItems.has(note.id) || selectedIds.has(note.id);
                  const isAlreadySelected = selectedIds.has(note.id);

                  return (
                    <div
                      key={note.id}
                      onClick={() => !isAlreadySelected && handleToggleItem(note.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                      } ${isAlreadySelected ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-neutral-300 dark:border-dark-500'
                        }`}>
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-dark-100 truncate flex items-center gap-2">
                            {note.icon && <span>{note.icon}</span>}
                            {note.title}
                          </p>
                          {note.updatedAt && (
                            <p className="text-sm text-neutral-500 dark:text-dark-400">
                              {formatDate(note.updatedAt)}
                            </p>
                          )}
                          {note.content && (
                            <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1 line-clamp-2">
                              {note.content}
                            </p>
                          )}
                        </div>

                        {isAlreadySelected && (
                          <span className="text-xs bg-primary text-white px-2 py-1 rounded">
                            Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-dark-600">
          <p className="text-sm text-neutral-500 dark:text-dark-400">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-700 dark:text-dark-300 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
