import { useState, useEffect, useRef } from 'react';
import { useNotesContext } from '../../contexts/NotesContext';

// Common emoji icons for notes
const NOTE_ICONS = ['📝', '📁', '💡', '📌', '🎯', '🔖', '📋', '✨', '🚀', '💼', '📚', '🎨', '🔧', '💻', '📊', '🗂️'];

// Common colors for notes
const NOTE_COLORS = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

interface NoteCreateFormProps {
  parentId: string | null;
}

export function NoteCreateForm({ parentId }: NoteCreateFormProps) {
  const { createNote, cancelCreating } = useNotesContext();
  const [title, setTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📝');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input when form appears
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createNote({
        title: trimmedTitle,
        icon: selectedIcon,
        color: selectedColor,
        parentId,
      });
    } catch (error) {
      console.error('Failed to create note:', error);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    cancelCreating();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Title Input */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title..."
        className="w-full px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-background-dark text-text-default dark:text-text-dark-default"
        disabled={isSubmitting}
      />

      {/* Icon Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-full"
        >
          <span className="text-lg">{selectedIcon}</span>
          <span className="flex-1 text-left text-text-secondary dark:text-text-dark-secondary">
            Choose icon
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showIconPicker ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showIconPicker && (
          <div className="absolute z-10 mt-1 p-2 bg-white dark:bg-background-card-dark border border-border dark:border-border-dark rounded-lg shadow-lg grid grid-cols-8 gap-1">
            {NOTE_ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => {
                  setSelectedIcon(icon);
                  setShowIconPicker(false);
                }}
                className={`p-2 text-xl rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  selectedIcon === icon ? 'bg-primary-light dark:bg-primary/20' : ''
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-full"
        >
          {selectedColor ? (
            <span
              className="w-5 h-5 rounded border border-border dark:border-border-dark"
              style={{ backgroundColor: selectedColor }}
            />
          ) : (
            <span className="w-5 h-5 rounded border border-border dark:border-border-dark bg-gray-200 dark:bg-gray-700" />
          )}
          <span className="flex-1 text-left text-text-secondary dark:text-text-dark-secondary">
            Choose color
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showColorPicker ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showColorPicker && (
          <div className="absolute z-10 mt-1 p-2 bg-white dark:bg-background-card-dark border border-border dark:border-border-dark rounded-lg shadow-lg space-y-1">
            {NOTE_COLORS.map(color => (
              <button
                key={color.name}
                type="button"
                onClick={() => {
                  setSelectedColor(color.value);
                  setShowColorPicker(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full"
              >
                {color.value ? (
                  <span
                    className="w-4 h-4 rounded border border-border dark:border-border-dark"
                    style={{ backgroundColor: color.value }}
                  />
                ) : (
                  <span className="w-4 h-4 rounded border border-dashed border-border dark:border-border-dark" />
                )}
                <span className="text-text-default dark:text-text-dark-default">{color.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-border dark:border-border-dark rounded-lg font-medium cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-text-default dark:text-text-dark-default disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
