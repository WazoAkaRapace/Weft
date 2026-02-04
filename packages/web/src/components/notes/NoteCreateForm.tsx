import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useNotesContext } from '../../contexts/NotesContext';
import { useTemplates } from '../../hooks/useTemplates';
import type { Template } from '@weft/shared';

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
  const navigate = useNavigate();
  const { createNote, cancelCreating } = useNotesContext();
  const { templates } = useTemplates();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📝');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerPosition, setTemplatePickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);

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
      const result = await createNote({
        title: trimmedTitle,
        content: content || undefined,
        icon: selectedIcon,
        color: selectedColor,
        parentId,
      });
      // Navigate to the newly created note
      navigate(`/notes/${result.id}`);
    } catch (error) {
      console.error('Failed to create note:', error);
      setIsSubmitting(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setContent(template.content || '');
    setSelectedIcon(template.icon);
    setSelectedColor(template.color);
    setShowTemplatePicker(false);
    setTemplatePickerPosition(null);
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setTitle('');
    setContent('');
    setSelectedIcon('📝');
    setSelectedColor(null);
  };

  const handleToggleTemplatePicker = () => {
    if (showTemplatePicker) {
      setShowTemplatePicker(false);
      setTemplatePickerPosition(null);
    } else if (templateButtonRef.current) {
      const rect = templateButtonRef.current.getBoundingClientRect();
      setTemplatePickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
      setShowTemplatePicker(true);
    }
  };

  const handleCancel = () => {
    cancelCreating();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Template Selector */}
      {!selectedTemplate && (
        <div>
          <button
            ref={templateButtonRef}
            type="button"
            onClick={handleToggleTemplatePicker}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors w-full"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="flex-1 text-left text-neutral-500 dark:text-dark-400">
              Start from template
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showTemplatePicker && templatePickerPosition && createPortal(
            <div
              className="fixed z-50 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              style={{
                top: `${templatePickerPosition.top}px`,
                left: `${templatePickerPosition.left}px`,
                width: `${templatePickerPosition.width}px`,
              }}
            >
              {templates.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 dark:text-dark-400 text-sm">
                  No templates yet. Create one in Manage Templates.
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
                  >
                    <span className="text-lg">{template.icon}</span>
                    <span className="flex-1 text-left text-sm truncate">{template.title}</span>
                  </button>
                ))
              )}
            </div>,
            document.body
          )}
        </div>
      )}

      {selectedTemplate && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
          <span className="text-sm text-primary-700 dark:text-primary-300">
            Template: {selectedTemplate.title}
          </span>
          <button
            type="button"
            onClick={handleClearTemplate}
            className="ml-auto text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Title Input */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title..."
        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-neutral-900 dark:text-dark-50"
        disabled={isSubmitting}
      />

      {/* Icon Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors w-full"
        >
          <span className="text-lg">{selectedIcon}</span>
          <span className="flex-1 text-left text-neutral-500 dark:text-dark-400">
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
          <div className="absolute z-10 mt-1 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg grid grid-cols-8 gap-1">
            {NOTE_ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => {
                  setSelectedIcon(icon);
                  setShowIconPicker(false);
                }}
                className={`p-2 text-xl rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors ${
                  selectedIcon === icon ? 'bg-primary-50 dark:bg-primary-900/30' : ''
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
          className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 dark:border-dark-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 transition-colors w-full"
        >
          {selectedColor ? (
            <span
              className="w-5 h-5 rounded border border-neutral-200 dark:border-dark-600"
              style={{ backgroundColor: selectedColor }}
            />
          ) : (
            <span className="w-5 h-5 rounded border border-neutral-200 dark:border-dark-600 bg-neutral-200 dark:bg-dark-700" />
          )}
          <span className="flex-1 text-left text-neutral-500 dark:text-dark-400">
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
          <div className="absolute z-10 mt-1 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg space-y-1">
            {NOTE_COLORS.map(color => (
              <button
                key={color.name}
                type="button"
                onClick={() => {
                  setSelectedColor(color.value);
                  setShowColorPicker(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors w-full"
              >
                {color.value ? (
                  <span
                    className="w-4 h-4 rounded border border-neutral-200 dark:border-dark-600"
                    style={{ backgroundColor: color.value }}
                  />
                ) : (
                  <span className="w-4 h-4 rounded border border-dashed border-neutral-200 dark:border-dark-600" />
                )}
                <span className="text-neutral-700 dark:text-dark-200">{color.name}</span>
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
          className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg font-medium cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-dark-700 text-neutral-900 dark:text-dark-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
