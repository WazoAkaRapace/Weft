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
      {/* Backdrop overlay - mobile only */}
      {isContextOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsContextOpen(false)}
        />
      )}

      {/* Context Sidebar - full-page drawer on mobile, sidebar on desktop */}
      <div className={`
        fixed md:relative inset-0 md:inset-auto right-0 top-0 h-full z-50
        md:w-80 md:h-full
        transition-transform duration-300 ease-in-out
        ${isContextOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <ContextSelector
          selected={selectedContext}
          onChange={setSelectedContext}
          onClose={() => setIsContextOpen(false)}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
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
