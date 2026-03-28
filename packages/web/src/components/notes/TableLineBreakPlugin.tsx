import { realmPlugin, addNestedEditorChild$ } from '@mdxeditor/editor';
import { useEffect, useRef } from 'react';

/**
 * A plugin that enables Shift+Enter to insert line breaks in table cells.
 *
 * By default, MDXEditor's table plugin intercepts both Enter and Shift+Enter
 * to navigate between cells. This plugin injects a component that intercepts
 * Shift+Enter at the DOM level (capture phase) and inserts a line break instead.
 *
 * Usage:
 * ```tsx
 * <MDXEditor plugins={[tablePlugin(), tableLineBreakPlugin()]} />
 * ```
 */
export const tableLineBreakPlugin = realmPlugin({
  init(realm) {
    // Inject our component into all nested editors (including table cells)
    realm.pub(addNestedEditorChild$, TableLineBreakHandler);
  },
});

/**
 * Component injected into each nested editor (table cells).
 * Uses DOM-level event interception to handle Shift+Enter before Lexical.
 */
function TableLineBreakHandler() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the contenteditable element within this nested editor
    const timer = setTimeout(() => {
      const contentEditable = containerRef.current?.parentElement?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (contentEditable) {
        contentEditable.addEventListener('keydown', handleShiftEnter, { capture: true });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      const contentEditable = containerRef.current?.parentElement?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (contentEditable) {
        contentEditable.removeEventListener('keydown', handleShiftEnter, { capture: true });
      }
    };
  }, []);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}

/**
 * Handle Shift+Enter keydown to insert a line break.
 * This runs in capture phase before Lexical's handlers.
 */
function handleShiftEnter(event: KeyboardEvent): void {
  if (!event.shiftKey || event.key !== 'Enter') {
    return;
  }

  // Prevent Lexical's default behavior (cell navigation)
  event.preventDefault();
  event.stopPropagation();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  // Create a line break element
  const br = document.createElement('br');

  // Insert the line break at cursor position
  range.deleteContents();
  range.insertNode(br);

  // Move cursor after the line break
  range.setStartAfter(br);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  // Ensure there's a text node after the br for cursor placement
  // This is needed if br is the last element in the cell
  if (!br.nextSibling || (br.nextSibling.nodeType === Node.TEXT_NODE && !br.nextSibling.textContent)) {
    const zwsp = document.createTextNode('\u200B'); // Zero-width space
    br.after(zwsp);
    range.setStartAfter(zwsp);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Dispatch input event to notify Lexical of the change
  const inputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertLineBreak',
  });
  br.parentElement?.dispatchEvent(inputEvent);

  const afterInputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: false,
    inputType: 'insertLineBreak',
  });
  br.parentElement?.dispatchEvent(afterInputEvent);
}

// Export as default plugin for easier usage
export default tableLineBreakPlugin;
