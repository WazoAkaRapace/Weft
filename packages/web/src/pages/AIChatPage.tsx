import { useState } from 'react';
import { useAIChat, ContextItem } from '../hooks/useAIChat';
import { ChatInput } from '../components/ai-chat/ChatInput';
import { ChatMessages } from '../components/ai-chat/ChatMessages';
import { ContextSelector } from '../components/ai-chat/ContextSelector';

export function AIChatPage() {
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);

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
    <div className="flex h-full bg-white dark:bg-dark-800">
      {/* Context Sidebar */}
      <ContextSelector
        selected={selectedContext}
        onChange={setSelectedContext}
      />

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
        />
      </div>
    </div>
  );
}
