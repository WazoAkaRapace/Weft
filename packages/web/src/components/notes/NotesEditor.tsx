import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  diffSourcePlugin,
  linkPlugin,
  tablePlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  toolbarPlugin,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  CodeToggle,
  ListsToggle,
  CreateLink,
  InsertTable,
  InsertAdmonition,
  UndoRedo,
} from '@mdxeditor/editor';

interface NotesEditorProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
  className?: string;
}

const AUTOSAVE_DELAY = 30000; // 30 seconds

export function NotesEditor({
  notes: initialNotes,
  onSave,
  className = '',
}: NotesEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [currentMarkdown, setCurrentMarkdown] = useState(initialNotes || '');
  const [isEditing, setIsEditing] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);

  // Update editor when initialNotes changes from parent
  useEffect(() => {
    if (initialNotes !== currentMarkdown) {
      setCurrentMarkdown(initialNotes || '');
      // Use setMarkdown to update the editor content without losing focus
      if (mdxEditorRef.current && initialNotes !== null) {
        mdxEditorRef.current.setMarkdown(initialNotes);
      }
    }
  }, [initialNotes]);

  const saveNotes = useCallback(
    async (notesToSave: string) => {
      setIsSaving(true);
      setSaveStatus('saving');

      try {
        await onSave(notesToSave);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      }
    },
    [onSave]
  );

  const handleChange = useCallback(
    (newMarkdown: string) => {
      setCurrentMarkdown(newMarkdown);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveNotes(newMarkdown);
      }, AUTOSAVE_DELAY);
    },
    [saveNotes]
  );

  const handleManualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Get current markdown from the editor
    const currentContent = mdxEditorRef.current?.getMarkdown() || currentMarkdown;
    saveNotes(currentContent);
  }, [currentMarkdown, saveNotes]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const wordCount = currentMarkdown.trim() ? currentMarkdown.trim().split(/\s+/).length : 0;
  const charCount = currentMarkdown.length;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xl text-text-default dark:text-text-dark-default">
            Notes
          </h3>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border dark:border-border-dark hover:bg-background dark:hover:bg-background-dark transition-colors"
          >
            {isEditing ? '👁️ View' : '✏️ Edit'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm px-3 py-1 rounded bg-success-light dark:bg-success/20 text-success">
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm px-3 py-1 rounded bg-danger-light dark:bg-danger/20 text-danger">
              Failed to save
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-sm px-3 py-1 rounded bg-primary-light/50 dark:bg-primary/20 text-primary">
              Saving...
            </span>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Save
            </button>
          )}
        </div>
      </div>

      <div className={`mdxeditor-wrapper min-h-[300px] border border-border dark:border-border-dark rounded-lg transition-all ${isEditing ? 'focus-within:border-border-focus' : 'mdxeditor-view-mode'}`}>
        <MDXEditor
          ref={mdxEditorRef}
          markdown={currentMarkdown}
          onChange={handleChange}
          contentEditableClassName="prose min-h-[300px] focus:outline-none"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            tablePlugin(),
            directivesPlugin({
              directiveDescriptors: [AdmonitionDirectiveDescriptor],
            }),
            markdownShortcutPlugin(),
            ...(isEditing
              ? [
                  toolbarPlugin({
                    toolbarContents: () => (
                      <>
                        <UndoRedo />
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles />
                        <StrikeThroughSupSubToggles />
                        <CodeToggle />
                        <ListsToggle />
                        <CreateLink />
                        <InsertTable />
                        <InsertAdmonition />
                      </>
                    ),
                  }),
                ]
              : []),
            diffSourcePlugin(),
          ]}
          readOnly={isSaving || !isEditing}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {charCount} characters, {wordCount} words
        </span>
      </div>
    </div>
  );
}
