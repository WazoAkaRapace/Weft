import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiUrl } from '../lib/config';

export interface ContextItem {
  type: 'journal' | 'note';
  id: string;
  title: string;
  content?: string;
  date?: string;
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  status: 'calling' | 'executing' | 'completed' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface ThinkingBlock {
  content: string;
  isComplete: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  thinkingBlocks?: ThinkingBlock[];
  isThinking?: boolean;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

/**
 * Parse thinking content from text that may contain thinking tags
 */
function parseThinkingFromText(text: string): { thinking: string; content: string; isThinking: boolean } {
  const patterns = [
    { regex: /<think\b[^>]*>([\s\S]*?)<\/think>/gi, hasEnd: true },
    { regex: /<think\/>([\s\S]*?)<\/think\/>/gi, hasEnd: true },
  ];

  for (const { regex } of patterns) {
    const matches = [...text.matchAll(new RegExp(regex.source, regex.flags))];

    if (matches.length > 0) {
      const thinkingParts: string[] = [];
      let content = text;

      for (const match of matches) {
        thinkingParts.push(match[1].trim());
        content = content.replace(match[0], '');
      }

      return {
        thinking: thinkingParts.join('\n\n'),
        content: content.trim(),
        isThinking: false,
      };
    }
  }

  const openTagMatch = text.match(/<think\b[^>]*>([^]*?)$/i);
  if (openTagMatch) {
    const thinkingContent = openTagMatch[1];
    const contentBefore = text.slice(0, openTagMatch.index);
    return {
      thinking: thinkingContent,
      content: contentBefore.trim(),
      isThinking: true,
    };
  }

  return {
    thinking: '',
    content: text,
    isThinking: false,
  };
}

interface UseAIChatOptions {
  conversationId?: string;
  agentId?: 'journalAgent' | 'assistantAgent';
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string;
  sendMessage: (message: string, context?: ContextItem[]) => Promise<void>;
  clearConversation: () => void;
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { conversationId: initialConversationId, agentId = 'assistantAgent' } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(
    initialConversationId || `conv-${Date.now()}`
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    context: ContextItem[] = []
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Track state outside React
    let hasStructuredReasoning = false;
    const thinkingBlocks: ThinkingBlock[] = [];
    const toolCallsMap = new Map<string, ToolCall>();
    let rawContent = '';

    // Create placeholder message
    const assistantMessageId = Date.now();
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      thinking: '',
      thinkingBlocks: [],
      isThinking: false,
      isStreaming: true,
      toolCalls: [],
      timestamp: new Date(assistantMessageId),
    }]);

    // Helper to update message with current state
    const updateMessage = () => {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];

        if (lastMessage?.role === 'assistant') {
          // Process thinking from raw content if no structured reasoning
          if (!hasStructuredReasoning) {
            const parsed = parseThinkingFromText(rawContent);
            lastMessage.content = parsed.content;
            lastMessage.thinking = parsed.thinking;
            lastMessage.isThinking = parsed.isThinking;
          } else {
            lastMessage.content = rawContent;
          }
        }

        return newMessages;
      });
    };

    try {
      const response = await fetch(`${getApiUrl()}/api/mastra/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          conversationId,
          agentId,
          context: { selectedItems: context },
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message: ${response.statusText}`);
      }

      const responseConversationId = response.headers.get('X-Conversation-ID');
      if (responseConversationId) {
        setConversationId(responseConversationId);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          updateMessage();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);

            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];

              if (lastMessage?.role === 'assistant') {
                switch (chunk.type) {
                  case 'reasoning-start':
                    hasStructuredReasoning = true;
                    lastMessage.isThinking = true;
                    thinkingBlocks.push({ content: '', isComplete: false });
                    lastMessage.thinkingBlocks = [...thinkingBlocks];
                    break;

                  case 'reasoning-delta':
                    if (thinkingBlocks.length > 0) {
                      thinkingBlocks[thinkingBlocks.length - 1].content += chunk.payload?.text || '';
                      lastMessage.thinkingBlocks = [...thinkingBlocks];
                      lastMessage.thinking = thinkingBlocks.map(b => b.content).join('\n\n---\n\n');
                    }
                    break;

                  case 'reasoning-end':
                    lastMessage.isThinking = false;
                    if (thinkingBlocks.length > 0) {
                      thinkingBlocks[thinkingBlocks.length - 1].isComplete = true;
                      lastMessage.thinkingBlocks = [...thinkingBlocks];
                    }
                    break;

                  case 'text-delta': {
                    // Simply accumulate text - component handles animation
                    const text = chunk.payload?.text || '';
                    rawContent += text;
                    lastMessage.content = rawContent;
                    break;
                  }

                  case 'tool-call':
                  case 'tool-call-input-streaming-start': {
                    const toolCallId = chunk.payload?.toolCallId;
                    const toolName = chunk.payload?.toolName;
                    if (toolCallId && toolName) {
                      const toolCall: ToolCall = {
                        toolCallId,
                        toolName,
                        status: 'calling',
                        args: chunk.payload?.args,
                      };
                      toolCallsMap.set(toolCallId, toolCall);
                      lastMessage.toolCalls = Array.from(toolCallsMap.values());
                    }
                    break;
                  }

                  case 'tool-call-delta': {
                    const toolCallId = chunk.payload?.toolCallId;
                    if (toolCallId) {
                      const existing = toolCallsMap.get(toolCallId);
                      if (existing) {
                        existing.status = 'executing';
                        lastMessage.toolCalls = Array.from(toolCallsMap.values());
                      }
                    }
                    break;
                  }

                  case 'tool-result': {
                    const toolCallId = chunk.payload?.toolCallId;
                    if (toolCallId) {
                      const existing = toolCallsMap.get(toolCallId);
                      if (existing) {
                        existing.status = 'completed';
                        existing.result = chunk.payload?.result;
                        lastMessage.toolCalls = Array.from(toolCallsMap.values());
                      }
                    }
                    break;
                  }

                  case 'tool-error': {
                    const toolCallId = chunk.payload?.toolCallId;
                    if (toolCallId) {
                      const existing = toolCallsMap.get(toolCallId);
                      if (existing) {
                        existing.status = 'error';
                        existing.error = chunk.payload?.error?.message || chunk.payload?.error || 'Tool execution failed';
                        lastMessage.toolCalls = Array.from(toolCallsMap.values());
                      }
                    }
                    break;
                  }

                  case 'error':
                    lastMessage.content = `Error: ${chunk.payload?.error || 'Unknown error'}`;
                    lastMessage.isStreaming = false;
                    break;

                  case 'finish':
                    // Content is already updated in text-delta
                    break;
                }
              }

              return newMessages;
            });
          } catch {
            // If JSON parsing fails, treat as plain text
            const text = line;
            rawContent += text;
            updateMessage();
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last?.role === 'assistant') {
          last.isStreaming = false;
          last.isThinking = false;
        }
        return newMsgs;
      });

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);

      setMessages(prev => {
        const filtered = prev.filter((msg, idx) =>
          !(idx === prev.length - 1 && msg.role === 'assistant' && msg.content === '')
        );
        return [...filtered, {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}`,
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, agentId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setConversationId(`conv-${Date.now()}`);
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearConversation,
  };
}
