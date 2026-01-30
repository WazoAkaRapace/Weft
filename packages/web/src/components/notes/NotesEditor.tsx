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
import { SlashCommandMenu, useSlashCommandDetection, type SlashCommand } from './SlashCommandPlugin';

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
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const markJustSelectedRef = useRef<(() => void) | null>(null);

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

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback((command: SlashCommand) => {
    // Mark that we just selected a command to prevent menu from re-opening
    markJustSelectedRef.current?.();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.endContainer;

    // Get text content up to cursor to find the slash command
    let textBeforeCursor = '';

    if (currentNode.nodeType === Node.TEXT_NODE) {
      textBeforeCursor = currentNode.textContent?.substring(0, range.endOffset) || '';
    }

    // Find the slash command in the text before cursor
    // Captures the text after the slash (e.g., "/q" captures "q", "/h1" captures "h1", "/" captures "")
    const slashMatch = textBeforeCursor.match(/\/([a-zA-Z0-9]*)$/);
    if (!slashMatch) {
      console.log('No slash command found in text before cursor:', textBeforeCursor);
      return;
    }

    const query = slashMatch[1]; // The captured text after slash: "q", "h1", "note", or "" for just "/"
    const slashText = query ? '/' + query : '/'; // Full slash command: "/q", "/h1", "/"

    console.log('Slash command found:', slashText, 'query:', query);

    // Get the ACTUAL current markdown from the editor (not React state which might be stale)
    const markdown = mdxEditorRef.current?.getMarkdown() || currentMarkdown;

    console.log('Current markdown:', markdown);

    // Build pattern to find the slash command in the markdown
    // Look for the slash command at the end of a line (e.g., "/q", "/", "/h1")
    const pattern = query ? new RegExp(`/${query}$`) : /\/$/;

    console.log('Pattern:', pattern.toString());

    // Find the last line that ends with the slash command
    const lines = markdown.split('\n');
    let foundLineIndex = -1;

    console.log('Lines:', lines);

    for (let i = lines.length - 1; i >= 0; i--) {
      if (pattern.test(lines[i])) {
        foundLineIndex = i;
        console.log('Found pattern at line', i, ':', lines[i]);
        break;
      }
    }

    if (foundLineIndex === -1) {
      console.log('Pattern not found in any line');
      return;
    }

    // Remove the slash command from the line
    lines[foundLineIndex] = lines[foundLineIndex].replace(pattern, '');

    // Insert the command text with a marker for cursor position
    const insertText = command.insertText;
    const CURSOR_MARKER = '%%CURSOR%%';

    if (insertText.startsWith(':::')) {
      // Admonition - insert on next line with cursor inside the block
      // e.g., ":::note\n%%CURSOR%%\n:::"
      const admonitionLines = insertText.split('\n');
      // Insert marker after the first line (inside the admonition)
      admonitionLines.splice(1, 0, CURSOR_MARKER);
      lines.splice(foundLineIndex + 1, 0, ...admonitionLines);
    } else {
      // Inline - append to the same line
      // For inline commands, place cursor after the inserted text
      lines[foundLineIndex] = lines[foundLineIndex] + insertText + CURSOR_MARKER;
    }

    const newMarkdown = lines.join('\n');

    console.log('New markdown:', newMarkdown);

    // Update the editor with the new markdown
    if (mdxEditorRef.current) {
      mdxEditorRef.current.setMarkdown(newMarkdown);

      // After markdown is set, find the marker and move cursor there
      setTimeout(() => {
        const editorContent = editorContainerRef.current;
        if (!editorContent) return;

        // Find the marker text node
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

          // Remove the marker from the text
          const textContent = markerNode.textContent.replace(CURSOR_MARKER, '');
          markerNode.textContent = textContent;

          // Move cursor to the marker position
          const newRange = document.createRange();
          newRange.setStart(markerNode, markerOffset);
          newRange.collapse(true);

          const newSelection = window.getSelection();
          newSelection?.removeAllRanges();
          newSelection?.addRange(newRange);
        }
      }, 0);
    }

    // Update React state without the marker
    const finalMarkdown = newMarkdown.replace(CURSOR_MARKER, '');
    handleChange(finalMarkdown);
  }, [currentMarkdown, handleChange]);

  // Set up slash command detection (only in edit mode)
  const { menuOpen, menuPosition, query, closeMenu, markJustSelected } = useSlashCommandDetection(
    handleSlashCommandSelect
  );

  // Store the markJustSelected function for use in handleSlashCommandSelect
  markJustSelectedRef.current = markJustSelected;

  return (
    <div className={`flex flex-col gap-1.5 sm:gap-4 h-full ${className}`}>
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto" style={{ overflowX: 'auto' }}>
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
      {/* Slash command menu - only show when editing */}
      {isEditing && (
        <SlashCommandMenu
          isOpen={menuOpen}
          position={menuPosition}
          query={query}
          onSelect={handleSlashCommandSelect}
          onClose={closeMenu}
        />
      )}
    </div>
  );
});
