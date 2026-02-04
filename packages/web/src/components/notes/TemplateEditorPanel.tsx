import { useState, useEffect, useRef } from 'react';
import { NotesEditor, type NotesEditorRef } from './NotesEditor';
import type { Template } from '@weft/shared';
import { createPortal } from 'react-dom';

// Common emoji icons for templates
const TEMPLATE_ICONS = ['📝', '📁', '💡', '📌', '🎯', '🔖', '📋', '✨', '🚀', '💼', '📚', '🎨', '🔧', '💻', '📊', '🗂️'];

// Common colors for templates
const TEMPLATE_COLORS = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

export interface CreateTemplateData {
  title: string;
  content?: string;
  icon?: string;
  color?: string;
}

export interface UpdateTemplateData {
  title?: string;
  content?: string;
  icon?: string;
  color?: string;
}

interface TemplateEditorPanelProps {
  template: Template | null;
  isCreating: boolean;
  onClose: () => void;
  createTemplate: (data: CreateTemplateData) => Promise<Template>;
  updateTemplate: (id: string, data: UpdateTemplateData) => Promise<void>;
  onTemplateCreated?: (template: Template) => void;
}

export function TemplateEditorPanel({ template, isCreating, onClose, createTemplate, updateTemplate, onTemplateCreated }: TemplateEditorPanelProps) {
  const [title, setTitle] = useState(template?.title || '');
  const [icon, setIcon] = useState(template?.icon || '📝');
  const [color, setColor] = useState(template?.color || null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [iconPickerPosition, setIconPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; right: number } | null>(null);

  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const notesEditorRef = useRef<NotesEditorRef>(null);

  // Update form when template changes
  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setIcon(template.icon);
      setColor(template.color);
    } else if (!isCreating) {
      setTitle('');
      setIcon('📝');
      setColor(null);
    }
  }, [template, isCreating]);

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      // Get content from the editor
      const editorContent = notesEditorRef.current?.hasUnsavedChanges()
        ? await notesEditorRef.current?.save()
        : template?.content || '';

      if (template) {
        await updateTemplate(template.id, {
          title: title.trim(),
          content: editorContent || undefined,
          icon,
          color,
        });
      } else {
        const createdTemplate = await createTemplate({
          title: title.trim(),
          content: editorContent,
          icon,
          color,
        });
        // Notify parent that template was created so it can switch to edit mode
        onTemplateCreated?.(createdTemplate);
      }

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to save template:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleIconPicker = () => {
    if (showIconPicker) {
      setShowIconPicker(false);
      setIconPickerPosition(null);
    } else if (iconButtonRef.current) {
      const rect = iconButtonRef.current.getBoundingClientRect();
      setIconPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
      setShowIconPicker(true);
    }
  };

  const handleToggleColorPicker = () => {
    if (showColorPicker) {
      setShowColorPicker(false);
      setColorPickerPosition(null);
    } else if (colorButtonRef.current) {
      const rect = colorButtonRef.current.getBoundingClientRect();
      setColorPickerPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setShowColorPicker(true);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-800">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-dark-600">
        <div className="flex items-center gap-4">
          {/* Icon Picker */}
          <div className="relative">
            <button
              ref={iconButtonRef}
              onClick={handleToggleIconPicker}
              className="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500 transition-colors text-2xl"
              style={color ? { backgroundColor: `${color}20` } : undefined}
            >
              {icon}
            </button>

            {showIconPicker && iconPickerPosition && createPortal(
              <div
                className="fixed z-50 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg grid grid-cols-8 gap-1"
                style={{ top: `${iconPickerPosition.top}px`, left: `${iconPickerPosition.left}px` }}
              >
                {TEMPLATE_ICONS.map((iconOption) => (
                  <button
                    key={iconOption}
                    onClick={() => {
                      setIcon(iconOption);
                      setShowIconPicker(false);
                      setIconPickerPosition(null);
                    }}
                    className={`p-2 text-xl rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors ${
                      icon === iconOption ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                    }`}
                  >
                    {iconOption}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Template title..."
            className="flex-1 px-3 py-2 text-xl font-semibold border-0 focus:outline-none focus:ring-0 bg-transparent text-neutral-900 dark:text-dark-50 placeholder:text-neutral-400 dark:placeholder:text-dark-500"
          />

          {/* Color Picker */}
          <div className="relative">
            <button
              ref={colorButtonRef}
              onClick={handleToggleColorPicker}
              className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                color ? '' : 'bg-neutral-200 dark:bg-dark-700'
              }`}
              style={color ? { backgroundColor: color, borderColor: color } : undefined}
            />

            {showColorPicker && colorPickerPosition && createPortal(
              <div
                className="fixed z-50 p-2 bg-white dark:bg-dark-800 border border-neutral-200 dark:border-dark-600 rounded-lg shadow-lg space-y-1 max-h-60 overflow-y-auto"
                style={{ top: `${colorPickerPosition.top}px`, right: `${colorPickerPosition.right}px` }}
              >
                {TEMPLATE_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.name}
                    onClick={() => {
                      setColor(colorOption.value);
                      setShowColorPicker(false);
                      setColorPickerPosition(null);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors w-full"
                  >
                    {colorOption.value ? (
                      <span
                        className="w-4 h-4 rounded border border-neutral-200 dark:border-dark-600 flex-shrink-0"
                        style={{ backgroundColor: colorOption.value }}
                      />
                    ) : (
                      <span className="w-4 h-4 rounded border border-dashed border-neutral-200 dark:border-dark-600 flex-shrink-0" />
                    )}
                    <span className="text-neutral-700 dark:text-dark-200">{colorOption.name}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              saveStatus === 'saved'
                ? 'bg-success text-white'
                : saveStatus === 'error'
                ? 'bg-error text-white'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
            title={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Failed' : 'Save'}
          >
            {saveStatus === 'saved' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Saving...
              </>
            ) : saveStatus === 'error' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Failed
              </>
            ) : (
              'Save'
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 6 6 18" />
              <polyline points="6 6 18 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <NotesEditor
          ref={notesEditorRef}
          notes={template?.content || null}
          onSave={async (content) => {
            if (!title.trim() || isSaving) return;
            setIsSaving(true);
            try {
              if (template) {
                await updateTemplate(template.id, {
                  title: title.trim(),
                  content,
                  icon,
                  color,
                });
              } else {
                const createdTemplate = await createTemplate({
                  title: title.trim(),
                  content,
                  icon,
                  color,
                });
                // Notify parent that template was created so it can switch to edit mode
                onTemplateCreated?.(createdTemplate);
              }
            } finally {
              setIsSaving(false);
            }
          }}
          isEditing={true}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
