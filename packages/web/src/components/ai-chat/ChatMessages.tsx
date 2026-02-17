import { useRef, useEffect, useState, useCallback } from 'react';
import type { ChatMessage, ToolCall, ThinkingBlock } from '../../hooks/useAIChat';
import { StreamingText } from './StreamingText';
import { ThemeIcon } from '../ui/ThemeIcon';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

export function ChatMessages({ messages, isLoading, error }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [animatedIndices, setAnimatedIndices] = useState<Set<number>>(new Set());
  const prevMessagesLengthRef = useRef(0);

  // Track which messages should be animated (new messages)
  // This is a valid pattern for tracking animation state - the ref tracks previous length
  // and we update animation state when new messages arrive
  useEffect(() => {
    const newIndices = new Set<number>();
    for (let i = prevMessagesLengthRef.current; i < messages.length; i++) {
      newIndices.add(i);
    }
    if (newIndices.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Animation tracking needs to update state when messages change
      setAnimatedIndices(newIndices);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  // Check if user is near the bottom of the scroll container
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider "near bottom" if within 100px of the bottom
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  // Handle scroll events to detect when user scrolls up
  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      setShouldAutoScroll(true);
    } else {
      setShouldAutoScroll(false);
    }
  }, [isNearBottom]);

  // Auto-scroll only when shouldAutoScroll is true
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          <ThemeIcon name="ai" alt="AI" size={128} />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-dark-100">
              Welcome to AI Chat
            </h2>
            <p className="text-neutral-600 dark:text-dark-400 max-w-md">
              Ask me anything about your journals, notes, or mood patterns.
              Select items from the sidebar to add context to our conversation.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-neutral-500 dark:text-dark-500 max-w-md">
            <div className="flex items-start gap-2 p-3 bg-neutral-100 dark:bg-dark-700 rounded-lg">
              <span>💡</span>
              <span>"Summarize how I've been feeling this week"</span>
            </div>
            <div className="flex items-start gap-2 p-3 bg-neutral-100 dark:bg-dark-700 rounded-lg">
              <span>🔍</span>
              <span>"What patterns do you notice in my recent journals?"</span>
            </div>
            <div className="flex items-start gap-2 p-3 bg-neutral-100 dark:bg-dark-700 rounded-lg">
              <span>📝</span>
              <span>"Help me reflect on my note about [topic]"</span>
            </div>
          </div>
        </div>
      )}

      {messages
        .map((message, originalIndex) => ({ message, originalIndex }))
        .filter(({ message }) => {
          // Always show user messages
          if (message.role === 'user') return true;
          // Only show assistant messages when they have content
          const hasContent = message.content && message.content.length > 0;
          const hasThinking = (message.thinkingBlocks && message.thinkingBlocks.length > 0) ||
                              (message.thinking && message.thinking.length > 0);
          const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
          return hasContent || hasThinking || hasToolCalls;
        })
        .map(({ message, originalIndex }) => (
          <MessageBubble
            key={originalIndex}
            message={message}
            formatTime={formatTime}
            shouldAnimate={animatedIndices.has(originalIndex)}
          />
        ))}

      {isLoading && messages.length > 0 && (
        <div className="flex items-center gap-2 text-neutral-500 dark:text-dark-400">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-error-light/10 dark:bg-error-dark-light/10 border border-error-light/30 dark:border-error-dark-light/30 rounded-lg">
          <p className="text-sm text-error-dark dark:text-error-light">{error}</p>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  formatTime: (date: Date) => string;
  shouldAnimate?: boolean;
}

function MessageBubble({ message, formatTime, shouldAnimate = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showThinking, setShowThinking] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);

  const hasThinkingBlocks = message.thinkingBlocks && message.thinkingBlocks.length > 0;
  const hasLegacyThinking = message.thinking && message.thinking.length > 0;
  const hasThinking = hasThinkingBlocks || hasLegacyThinking;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const activeToolCalls = message.toolCalls?.filter(t => t.status === 'calling' || t.status === 'executing') || [];
  const hasActiveToolCalls = activeToolCalls.length > 0;

  // Auto-expand tool calls section when there are active tool calls
  useEffect(() => {
    if (hasActiveToolCalls) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Auto-expand UI when tools are actively running
      setShowToolCalls(true);
    }
  }, [hasActiveToolCalls]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3
        ${isUser
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-neutral-100 dark:bg-dark-700 text-neutral-900 dark:text-dark-100 rounded-bl-sm'
        }
        ${shouldAnimate ? (isUser ? 'animate-message-user' : 'animate-message-assistant') : ''}
      `}>
        {/* Thinking section - collapsible */}
        {hasThinking && !isUser && (
          <div className="mb-2">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1 text-xs text-neutral-500 dark:text-dark-400 hover:text-neutral-700 dark:hover:text-dark-200 transition-colors"
            >
              <span className={`transform transition-transform ${showThinking ? 'rotate-90' : ''}`}>▶</span>
              <span className="flex items-center gap-1">
                {message.isThinking && (
                  <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                )}
                Thinking {hasThinkingBlocks && message.thinkingBlocks ? `(${message.thinkingBlocks.length})` : ''}
              </span>
            </button>
            {showThinking && (
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {hasThinkingBlocks && message.thinkingBlocks ? (
                  message.thinkingBlocks.map((block, index, blocks) => (
                    <ThinkingBlockDisplay
                      key={index}
                      block={block}
                      index={index}
                      isLast={index === blocks.length - 1}
                      isActive={message.isThinking && index === blocks.length - 1}
                    />
                  ))
                ) : (
                  <div className="p-2 bg-neutral-200/50 dark:bg-dark-600/50 rounded-lg text-xs text-neutral-600 dark:text-dark-300 italic">
                    {message.thinking}
                    {message.isThinking && (
                      <span className="inline-block w-1 h-3 bg-neutral-400 dark:bg-dark-400 animate-pulse ml-0.5"></span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tool calls section - collapsible */}
        {hasToolCalls && !isUser && (
          <div className="mb-2">
            <button
              onClick={() => setShowToolCalls(!showToolCalls)}
              className="flex items-center gap-1 text-xs text-neutral-500 dark:text-dark-400 hover:text-neutral-700 dark:hover:text-dark-200 transition-colors"
            >
              <span className={`transform transition-transform ${showToolCalls ? 'rotate-90' : ''}`}>▶</span>
              <span className="flex items-center gap-1">
                {hasActiveToolCalls && (
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                )}
                Tools ({message.toolCalls?.length})
              </span>
            </button>
            {showToolCalls && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {message.toolCalls?.map((tool) => (
                  <ToolCallDisplay key={tool.toolCallId} tool={tool} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main content - smooth streaming for assistant, plain for user */}
        <div className={isUser ? '' : 'prose prose-sm dark:prose-invert max-w-none'}>
          {isUser ? (
            // User messages: simple text display
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            // Assistant messages: smooth streaming with markdown formatting
            <StreamingText
              text={message.content}
              isStreaming={message.isStreaming ?? false}
              formatMarkdown={formatContent}
              messageKey={message.timestamp.getTime()}
            />
          )}
        </div>
        <span className={`text-xs mt-1 block ${isUser ? 'text-white/70' : 'text-neutral-500 dark:text-dark-400'}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

/**
 * Format content with markdown (only applied after streaming ends)
 */
function formatContent(text: string): string {
  if (!text) return '';

  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-neutral-800 dark:bg-dark-800 text-neutral-100 p-3 rounded-lg overflow-x-auto my-2 text-sm"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Headers
  formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1 text-neutral-900 dark:text-dark-100">$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2 text-neutral-900 dark:text-dark-100">$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2 text-neutral-900 dark:text-dark-100">$1</h1>');

  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Italic
  formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-neutral-200 dark:bg-dark-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Links
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Lists
  formatted = formatted.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Wrap list items
  formatted = formatted.replace(/(<li class="ml-4 list-disc">[\s\S]*?<\/li>)+/g, '<ul class="my-2 space-y-1">$&</ul>');
  formatted = formatted.replace(/(<li class="ml-4 list-decimal">[\s\S]*?<\/li>)+/g, '<ol class="my-2 space-y-1">$&</ol>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr class="my-3 border-neutral-300 dark:border-dark-600" />');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br />');

  // Clean up breaks after block elements
  formatted = formatted.replace(/<\/h[1-3]><br \/>/g, '</h1>');
  formatted = formatted.replace(/<\/pre><br \/>/g, '</pre>');
  formatted = formatted.replace(/<\/ul><br \/>/g, '</ul>');
  formatted = formatted.replace(/<\/ol><br \/>/g, '</ol>');
  formatted = formatted.replace(/<\/li><br \/>/g, '</li>');

  return formatted;
}

/**
 * Tool Call Display Component
 */
function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  const statusColors = {
    calling: 'text-blue-500',
    executing: 'text-yellow-500',
    completed: 'text-green-500',
    error: 'text-red-500',
  };

  const statusIcons = {
    calling: '🔄',
    executing: '⚡',
    completed: '✓',
    error: '✗',
  };

  const statusLabels = {
    calling: 'Calling...',
    executing: 'Executing...',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <div className={`p-2 bg-neutral-200/50 dark:bg-dark-600/50 rounded text-xs border-l-2 ${
      tool.status === 'error' ? 'border-red-500' :
      tool.status === 'completed' ? 'border-green-500' :
      'border-blue-500'
    }`}>
      <div className="flex items-center gap-2">
        <span className={statusColors[tool.status]}>{statusIcons[tool.status]}</span>
        <span className="font-medium text-neutral-700 dark:text-dark-200">{tool.toolName}</span>
        <span className={`text-neutral-500 dark:text-dark-400 ${statusColors[tool.status]}`}>
          {statusLabels[tool.status]}
        </span>
      </div>
      {tool.error && (
        <div className="mt-1 text-red-500 dark:text-red-400">
          {tool.error}
        </div>
      )}
      {tool.args && Object.keys(tool.args).length > 0 && (
        <div className="mt-1 text-neutral-500 dark:text-dark-400 font-mono text-[10px] overflow-hidden text-ellipsis">
          {JSON.stringify(tool.args)}
        </div>
      )}
    </div>
  );
}

/**
 * Thinking Block Display Component
 */
function ThinkingBlockDisplay({ block, index, isActive }: {
  block: ThinkingBlock;
  index: number;
  isLast: boolean;
  isActive: boolean;
}) {
  return (
    <div className="p-2 bg-neutral-200/50 dark:bg-dark-600/50 rounded-lg text-xs text-neutral-600 dark:text-dark-300 italic">
      {index > 0 && (
        <div className="text-[10px] text-neutral-400 dark:text-dark-500 mb-1 font-normal not-italic">
          ── Continued thinking ──
        </div>
      )}
      {block.content}
      {isActive && (
        <span className="inline-block w-1 h-3 bg-neutral-400 dark:bg-dark-400 animate-pulse ml-0.5"></span>
      )}
    </div>
  );
}
