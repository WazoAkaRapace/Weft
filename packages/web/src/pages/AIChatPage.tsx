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
    error,
    sendMessage,
    clearConversation,
  } = useAIChat({ agentId: 'assistantAgent' });

  const handleSendMessage = (message: string) => {
    sendMessage(message, selectedContext);
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
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          error={error}
        />

        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          onClear={clearConversation}
          hasContext={selectedContext.length > 0}
          onOpenContext={() => setIsContextOpen(true)}
          contextCount={selectedContext.length}
        />
      </div>
    </div>
  );
}
