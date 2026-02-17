import { useEffect, useRef, memo } from 'react';
import { useSmoothStream } from '../../hooks/useSmoothStream';

interface StreamingTextProps {
  /** Full content text (continuously growing during streaming) */
  text: string;
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** Function to format markdown to HTML */
  formatMarkdown: (text: string) => string;
  /** Unique key for the message (used to reset animation) */
  messageKey?: string | number;
}

/**
 * Component that displays text with smooth character-by-character animation during streaming.
 * Once streaming is complete, shows the full text immediately.
 */
export const StreamingText = memo(function StreamingText({
  text,
  isStreaming,
  formatMarkdown,
  messageKey,
}: StreamingTextProps) {
  const { visibleText, addText, reset, isComplete } = useSmoothStream();
  const lastMessageKeyRef = useRef<string | number | undefined>(messageKey);
  const lastTextLengthRef = useRef<number>(0);

  // Reset when message changes
  useEffect(() => {
    if (messageKey !== undefined && messageKey !== lastMessageKeyRef.current) {
      reset();
      lastMessageKeyRef.current = messageKey;
      lastTextLengthRef.current = 0;
    }
  }, [messageKey, reset]);

  // Add new text as it arrives
  useEffect(() => {
    if (text.length > lastTextLengthRef.current) {
      const newContent = text.slice(lastTextLengthRef.current);
      addText(newContent);
      lastTextLengthRef.current = text.length;
    }
  }, [text, addText]);

  // When streaming ends, skip to show all content immediately
  useEffect(() => {
    if (!isStreaming && text.length > visibleText.length) {
      // Streaming ended but animation hasn't caught up - skip to end
      addText(text.slice(visibleText.length));
    }
  }, [isStreaming, text, visibleText.length, addText]);

  // Show cursor while streaming and animating (derived state)
  const showCursor = isStreaming && !isComplete;

  // Determine what to show
  // During streaming: show animated visibleText
  // After streaming ends: show full text immediately
  const displayText = isComplete || !isStreaming ? text : visibleText;

  // Format the display text
  const formattedContent = formatMarkdown(displayText);

  return (
    <span>
      <span dangerouslySetInnerHTML={{ __html: formattedContent }} />
      {showCursor && <span className="streaming-cursor-smooth" />}
    </span>
  );
});
