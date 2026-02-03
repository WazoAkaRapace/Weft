import { useEffect } from 'react';
import type { Note } from '@weft/shared';
import { MDXEditor } from '@mdxeditor/editor';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  tablePlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
} from '@mdxeditor/editor';

interface NoteViewModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NoteViewModal({ note, isOpen, onClose }: NoteViewModalProps) {
  // Handle escape key and backdrop click
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    const backdrop = document.getElementById('note-modal-backdrop');
    backdrop?.addEventListener('click', handleBackdropClick);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      backdrop?.removeEventListener('click', handleBackdropClick);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !note) return null;

  return (
    <div
      id="note-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    >
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{note.icon}</span>
            <h2 className="text-xl font-semibold text-text-default dark:text-text-dark-default truncate">
              {note.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            aria-label="Close modal"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {note.content ? (
            <MDXEditor
              key={note.id}
              markdown={note.content}
              contentEditableClassName="prose max-w-none dark:prose-invert"
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
              ]}
              readOnly={true}
            />
          ) : (
            <p className="text-text-secondary dark:text-text-dark-secondary italic">
              This note has no content.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
