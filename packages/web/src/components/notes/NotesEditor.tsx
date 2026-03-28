import { useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
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
import { SlashCommandMenu, useSlashCommandDetection, type SlashCommand } from './SlashCommandPlugin';
import { tableLineBreakPlugin } from './TableLineBreakPlugin';

export interface NotesEditorRef {
  save: () => Promise<void>;
  hasUnsavedChanges: () => boolean;
}

interface NotesEditorProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
  isEditing?: boolean;
  isSaving?: boolean;
  className?: string;
}

const AUTOSAVE_DELAY = 5000; // 5 seconds

export const NotesEditor = forwardRef<NotesEditorRef, NotesEditorProps>(({
  notes: initialNotes,
  onSave,
  isEditing = true,
  isSaving = false,
  className = '',
}, ref) => {
  // Use refs only - no state that would cause re-renders during typing
  const hasUnsavedChangesRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const markJustSelectedRef = useRef<(() => void) | null>(null);

  const saveNotes = useCallback(
    async (notesToSave: string) => {
      await onSave(notesToSave);
      lastSavedContentRef.current = notesToSave;
      hasUnsavedChangesRef.current = false;
    },
    [onSave]
  );

  const handleChange = useCallback(
    (_newMarkdown: string) => {
      // Mark as having unsaved changes - don't update any state that causes re-renders
      hasUnsavedChangesRef.current = true;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        const latestMarkdown = mdxEditorRef.current?.getMarkdown();
        if (latestMarkdown !== undefined) {
          saveNotes(latestMarkdown);
        }
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
      const currentContent = mdxEditorRef.current?.getMarkdown() || initialNotes || '';
      await saveNotes(currentContent);
    },
    hasUnsavedChanges: () => hasUnsavedChangesRef.current,
  }), [initialNotes, saveNotes]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback((command: SlashCommand) => {
    markJustSelectedRef.current?.();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.endContainer;

    let textBeforeCursor = '';

    if (currentNode.nodeType === Node.TEXT_NODE) {
      textBeforeCursor = currentNode.textContent?.substring(0, range.endOffset) || '';
    }

    const slashMatch = textBeforeCursor.match(/\/\/?([a-zA-Z0-9]*)$/);
    if (!slashMatch) {
      return;
    }

    const query = slashMatch[1];
    const isDoubleSlash = textBeforeCursor.match(/\/\/([a-zA-Z0-9]*)$/);

    const markdown = mdxEditorRef.current?.getMarkdown() || initialNotes || '';

    const pattern = isDoubleSlash
      ? (query ? new RegExp(`//${query}$`) : /\/\/$/)
      : (query ? new RegExp(`/${query}$`) : /\/$/);

    const lines = markdown.split('\n');
    let foundLineIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (pattern.test(lines[i])) {
        foundLineIndex = i;
        break;
      }
    }

    if (foundLineIndex === -1) {
      return;
    }

    lines[foundLineIndex] = lines[foundLineIndex].replace(pattern, '');

    const insertText = typeof command.insertText === 'function'
      ? command.insertText()
      : command.insertText;
    const CURSOR_MARKER = '%%CURSOR%%';

    if (insertText.startsWith(':::')) {
      const admonitionLines = insertText.split('\n');
      admonitionLines.splice(1, 0, CURSOR_MARKER);
      lines.splice(foundLineIndex + 1, 0, ...admonitionLines);
    } else {
      lines[foundLineIndex] = lines[foundLineIndex] + insertText + CURSOR_MARKER;
    }

    const newMarkdown = lines.join('\n');

    if (mdxEditorRef.current) {
      mdxEditorRef.current.setMarkdown(newMarkdown);

      setTimeout(() => {
        const editorContent = editorContainerRef.current;
        if (!editorContent) return;

        const walker = document.createTreeWalker(
          editorContent,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              return node.textContent?.includes(CURSOR_MARKER)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
            }
          }
        );

        const markerNode = walker.nextNode();
        if (markerNode && markerNode.textContent) {
          const markerOffset = markerNode.textContent.indexOf(CURSOR_MARKER);

          const textContent = markerNode.textContent.replace(CURSOR_MARKER, '');
          markerNode.textContent = textContent;

          const newRange = document.createRange();
          newRange.setStart(markerNode, markerOffset);
          newRange.collapse(true);

          const newSelection = window.getSelection();
          newSelection?.removeAllRanges();
          newSelection?.addRange(newRange);
        }
      }, 0);
    }

    const finalMarkdown = newMarkdown.replace(CURSOR_MARKER, '');
    handleChange(finalMarkdown);
  }, [initialNotes, handleChange]);

  // Set up slash command detection
  const { menuOpen, menuPosition, query, isDoubleSlash, closeMenu, markJustSelected } = useSlashCommandDetection(
    handleSlashCommandSelect
  );

  useEffect(() => {
    markJustSelectedRef.current = markJustSelected;
  }, [markJustSelected]);

  return (
    <div className={`flex flex-col gap-1.5 sm:gap-4 h-full ${className}`}>
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto" style={{ overflowX: 'auto' }}>
        <MDXEditor
          key={isEditing ? 'edit' : 'view'}
          ref={mdxEditorRef}
          markdown={initialNotes || ''}
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
            tableLineBreakPlugin(),
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
                  diffSourcePlugin(),
                ]
              : []),
          ]}
          readOnly={isSaving || !isEditing}
        />
      </div>
      {isEditing && (
        <SlashCommandMenu
          isOpen={menuOpen}
          position={menuPosition}
          query={query}
          isDoubleSlash={isDoubleSlash}
          onSelect={handleSlashCommandSelect}
          onClose={closeMenu}
        />
      )}
    </div>
  );
});
