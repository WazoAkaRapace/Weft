import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
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

export interface NotesEditorRef {
  save: () => Promise<void>;
}

interface NotesEditorProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
  isEditing?: boolean;
  isSaving?: boolean;
  className?: string;
}

const AUTOSAVE_DELAY = 30000;

export const NotesEditor = forwardRef<NotesEditorRef, NotesEditorProps>(({
  notes: initialNotes,
  onSave,
  isEditing = true,
  isSaving = false,
  className = '',
}, ref) => {
  const [currentMarkdown, setCurrentMarkdown] = useState(initialNotes || '');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);

  // Update editor when initialNotes changes from parent
  useEffect(() => {
    if (initialNotes !== currentMarkdown) {
      const newContent = initialNotes || '';
      setCurrentMarkdown(newContent);
      // Use setMarkdown to update the editor content without losing focus
      if (mdxEditorRef.current) {
        mdxEditorRef.current.setMarkdown(newContent);
      }
    }
  }, [initialNotes]);

  const saveNotes = useCallback(
    async (notesToSave: string) => {
      await onSave(notesToSave);
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

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const currentContent = mdxEditorRef.current?.getMarkdown() || currentMarkdown;
      await saveNotes(currentContent);
    },
  }), [currentMarkdown, saveNotes]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col gap-1.5 sm:gap-4 h-full ${className}`}>
      <div className="flex-1 overflow-y-auto" style={{ overflowX: 'auto' }}>
        <MDXEditor
          key={isEditing ? 'editing' : 'viewing'}
          ref={mdxEditorRef}
          markdown={currentMarkdown}
          onChange={handleChange}
          contentEditableClassName="prose min-h-[300px] focus:outline-none px-3 sm:px-4 py-2 sm:py-3"
          plugins={[
            directivesPlugin({
              directiveDescriptors: [AdmonitionDirectiveDescriptor],
            }),
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            tablePlugin(),
            markdownShortcutPlugin(),
            ...(isEditing
              ? [
                  toolbarPlugin({
                    toolbarClassName: 'notes-editor-toolbar',
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
    </div>
  );
});
