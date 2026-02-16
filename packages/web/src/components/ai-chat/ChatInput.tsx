import { useState, FormEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  onClear: () => void;
  hasContext: boolean;
  onOpenContext: () => void;
  contextCount: number;
}

export function ChatInput({ onSend, disabled, onClear, hasContext, onOpenContext, contextCount }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-neutral-200 dark:border-dark-600 bg-white dark:bg-dark-800">
      {/* Context indicator */}
      {hasContext && (
        <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
          <p className="text-sm text-primary-700 dark:text-primary-300 flex items-center gap-2">
            <span>📎</span>
            <span>Context is being used for this conversation</span>
          </p>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your journals..."
            disabled={disabled}
            rows={1}
            className="flex-1 px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-100 placeholder-neutral-400 dark:placeholder-dark-400 resize-none"
            style={{ minHeight: '48px', maxHeight: '200px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          />

          {/* Context button */}
          <button
            type="button"
            onClick={onOpenContext}
            className="relative p-3 bg-neutral-100 dark:bg-dark-700 text-neutral-600 dark:text-dark-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-dark-600 transition-colors"
            aria-label="Open context panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {contextCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                {contextCount}
              </span>
            )}
          </button>

          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="px-4 md:px-6 py-3 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
          >
            {disabled ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Sending...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Send</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="rotate-90"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-neutral-500 dark:text-dark-400">
            Press Enter to send, Shift+Enter for new line
          </p>

          <button
            type="button"
            onClick={onClear}
            className="text-sm text-neutral-600 dark:text-dark-400 hover:text-neutral-900 dark:hover:text-dark-100 transition-colors flex items-center gap-1 px-3 py-1 rounded hover:bg-neutral-100 dark:hover:bg-dark-700"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear conversation
          </button>
        </div>
      </form>
    </div>
  );
}
