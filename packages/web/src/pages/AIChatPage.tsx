import { useState } from 'react';
import { useAIChat, ContextItem } from '../hooks/useAIChat';
import { ChatInput } from '../components/ai-chat/ChatInput';
import { ChatMessages } from '../components/ai-chat/ChatMessages';
import { ContextSelector } from '../components/ai-chat/ContextSelector';

export function AIChatPage() {
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);
  const [isContextOpen, setIsContextOpen] = useState(false);

  const {
    messages,
    isLoading,
    isInitializing,
    error,
    sendMessage,
    clearConversation,
  } = useAIChat({ agentId: 'assistantAgent' });

  const handleSendMessage = (message: string) => {
    sendMessage(message, selectedContext);
    // Clear context after sending so it's not repeated in subsequent messages
    setSelectedContext([]);
  };

  return (
    <div className="flex h-full bg-white dark:bg-dark-800 relative">
      {/* Backdrop overlay */}
      {isContextOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsContextOpen(false)}
        />
      )}

      {/* Context Sidebar - slide-in drawer from right */}
      <div className={`
        fixed right-0 top-0 h-full z-50
        w-full md:w-[48rem]
        transition-transform duration-300 ease-in-out
        ${isContextOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <ContextSelector
          selected={selectedContext}
          onChange={setSelectedContext}
          onClose={() => setIsContextOpen(false)}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {isInitializing ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading conversation...</span>
            </div>
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            error={error}
          />
        )}

        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading || isInitializing}
          onClear={clearConversation}
          hasContext={selectedContext.length > 0}
          onOpenContext={() => setIsContextOpen(true)}
          contextCount={selectedContext.length}
        />
      </div>
    </div>
  );
}
