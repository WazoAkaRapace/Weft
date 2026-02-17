import { useState, useEffect, useRef } from 'react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  keywords?: string[];
  insertText: string | (() => string);
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Admonitions
  {
    id: 'note',
    label: 'Note',
    description: 'A note admonition block',
    icon: '📝',
    keywords: ['note', 'blue', 'info'],
    insertText: ':::note\n\n:::',
  },
  {
    id: 'tip',
    label: 'Tip',
    description: 'A tip admonition block',
    icon: '💡',
    keywords: ['tip', 'green', 'helpful'],
    insertText: ':::tip\n\n:::',
  },
  {
    id: 'info',
    label: 'Info',
    description: 'An info admonition block',
    icon: 'ℹ️',
    keywords: ['info', 'blue', 'information'],
    insertText: ':::info\n\n:::',
  },
  {
    id: 'warning',
    label: 'Warning',
    description: 'A warning admonition block',
    icon: '⚠️',
    keywords: ['warning', 'yellow', 'caution'],
    insertText: ':::caution\n\n:::',
  },
  {
    id: 'danger',
    label: 'Danger',
    description: 'A danger admonition block',
    icon: '🔴',
    keywords: ['danger', 'red', 'error', 'critical'],
    insertText: ':::danger\n\n:::',
  },
  // Headings
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    keywords: ['h1', 'heading', 'title'],
    insertText: '# ',
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    keywords: ['h2', 'heading', 'subtitle'],
    insertText: '## ',
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    keywords: ['h3', 'heading'],
    insertText: '### ',
  },
  // Lists
  {
    id: 'bulletList',
    label: 'Bullet List',
    description: 'Create a bullet list',
    icon: '•',
    keywords: ['bullet', 'list', 'ul'],
    insertText: '- ',
  },
  {
    id: 'numberedList',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    keywords: ['numbered', 'list', 'ol'],
    insertText: '1. ',
  },
  // Other formatting
  {
    id: 'quote',
    label: 'Quote',
    description: 'Create a quote block',
    icon: '❝',
    keywords: ['quote', 'blockquote'],
    insertText: '> ',
  },
  {
    id: 'code',
    label: 'Code Block',
    description: 'Create a code block',
    icon: '</>',
    keywords: ['code', 'pre'],
    insertText: '```\n\n```',
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal divider',
    icon: '—',
    keywords: ['divider', 'hr', 'separator'],
    insertText: '---',
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a table',
    icon: '▦',
    keywords: ['table', 'grid'],
    insertText: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |',
  },
  // Date
  {
    id: 'date',
    label: 'Today\'s Date',
    description: 'Insert today\'s date',
    icon: '📅',
    keywords: ['date', 'today'],
    insertText: () => new Date().toISOString().split('T')[0],
  },
];

/**
 * Checks if the current selection is inside a nested editor (e.g., admonition)
 * by examining the DOM hierarchy for nested editor markers.
 *
 * Slash commands are disabled inside nested editors (admonitions, etc.)
 * because they use separate Lexical editor instances with isolated event systems.
 * See: https://github.com/mdx-editor/editor/blob/master/src/directive-editers/AdmonitionDirectiveDescriptor.tsx
 */
function isInsideNestedEditor(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  let currentNode: Node | null = range.endContainer;

  while (currentNode) {
    if (currentNode.nodeType === Node.DOCUMENT_NODE) {
      break;
    }

    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as Element;

      // Check for CSS class patterns that indicate nested editors
      if (element.className && typeof element.className === 'string') {
        if (element.className.includes('nestedEditor')) {
          return true;
        }
      }

      // Check for data-lexical-editor attribute - nested editors have a parent editor
      if (element.hasAttribute('data-lexical-editor')) {
        let parent: Element | null = element.parentElement;
        while (parent) {
          if (parent.hasAttribute('data-lexical-editor')) {
            return true; // Found parent editor, so current editor is nested
          }
          parent = parent.parentElement;
        }
      }
    }

    currentNode = currentNode.parentNode;
  }

  return false;
}

interface SlashCommandMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  query: string;
  isDoubleSlash?: boolean;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ isOpen, position, query, isDoubleSlash, onSelect, onClose }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on query
  const filteredCommands = SLASH_COMMANDS.filter(cmd => {
    // If double slash, only show date command
    if (isDoubleSlash) {
      return cmd.id === 'date';
    }

    const searchStr = `${cmd.label} ${cmd.description} ${(cmd.keywords || []).join(' ')}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  });

  // Reset selected index when query changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset selection to first item when filter changes
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedIndex >= 0 && isOpen) {
      // Small delay to ensure the button is rendered
      setTimeout(() => {
        const buttons = menuRef.current?.querySelectorAll('button');
        const selectedButton = buttons?.[selectedIndex] as HTMLElement;
        if (selectedButton) {
          selectedButton.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }, 0);
    }
  }, [selectedIndex, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filteredCommands.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filteredCommands[selectedIndex]);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use capture phase to intercept events before they reach the editor
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Adjust position to keep menu in viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.min(position.x, window.innerWidth - 320)}px`,
    top: `${Math.min(position.y, window.innerHeight - 400)}px`,
    zIndex: 1000,
  };

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div ref={menuRef} style={menuStyle} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[280px] max-h-80 overflow-y-auto">
      <div className="p-1">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            onClick={() => {
              onSelect(cmd);
              onClose();
            }}
            className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-3 transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-xl flex-shrink-0">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{cmd.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cmd.description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </p>
      </div>
    </div>
  );
}

// Hook to detect slash commands in markdown content
// eslint-disable-next-line react-refresh/only-export-components
export function useSlashCommandDetection(
  onSelect: (command: SlashCommand) => void
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [isDoubleSlash, setIsDoubleSlash] = useState(false);
  const justSelectedRef = useRef(false);

  // Listen to input events to detect slash commands
  useEffect(() => {
    const checkSlashCommand = () => {
      // Don't re-open menu immediately after a selection
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        setMenuOpen(false);
        setQuery('');
        return;
      }

      // Check if we're inside a nested editor (admonition, etc.)
      if (isInsideNestedEditor()) {
        if (menuOpen) {
          setMenuOpen(false);
          setQuery('');
        }
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setMenuOpen(false);
        setQuery('');
        return;
      }

      const range = selection.getRangeAt(0);
      const currentNode = range.endContainer;

      // Get text content up to cursor
      let textBeforeCursor = '';
      if (currentNode.nodeType === Node.TEXT_NODE) {
        textBeforeCursor = currentNode.textContent?.substring(0, range.endOffset) || '';
      } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
        // For element nodes, traverse to find text before cursor
        const tempRange = document.createRange();
        tempRange.selectNodeContents(currentNode as Element);
        tempRange.setEnd(range.endContainer, range.endOffset);
        textBeforeCursor = tempRange.toString();
      }

      // Check if there's a slash followed by non-space characters immediately before cursor
      const slashMatch = textBeforeCursor.match(/\/\/?([^\s\/][^\s]*)?$/);
      const doubleSlashMatch = textBeforeCursor.match(/\/\/$/);

      if (slashMatch) {
        const queryText = slashMatch[1] || '';
        setQuery(queryText);
        setIsDoubleSlash(!!doubleSlashMatch);

        // Get cursor position for menu
        const rect = range.getBoundingClientRect();
        setMenuPosition({
          x: rect.left,
          y: rect.bottom + 5,
        });
        setMenuOpen(true);
      } else {
        setMenuOpen(false);
        setQuery('');
        setIsDoubleSlash(false);
      }
    };

    // Listen to both input and keyup events for maximum compatibility
    document.addEventListener('input', checkSlashCommand, true);
    document.addEventListener('keyup', checkSlashCommand, true);

    return () => {
      document.removeEventListener('input', checkSlashCommand, true);
      document.removeEventListener('keyup', checkSlashCommand, true);
    };
  }, [menuOpen]);

  // Close menu if selection moves into a nested editor
  useEffect(() => {
    const handleSelectionChange = () => {
      if (menuOpen && isInsideNestedEditor()) {
        setMenuOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [menuOpen]);

  return {
    menuOpen,
    menuPosition,
    query,
    isDoubleSlash,
    closeMenu: () => setMenuOpen(false),
    markJustSelected: () => { justSelectedRef.current = true; },
    onSelect,
  };
}
