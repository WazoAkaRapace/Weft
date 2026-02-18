import { useEffect, useRef, memo, useLayoutEffect, useState } from 'react';
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
 * During streaming, displays plain text to avoid flickering from partial markdown.
 * After streaming completes, renders the full markdown formatting.
 * The container height is locked to prevent shrinking when transitioning to markdown.
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
  const containerRef = useRef<HTMLSpanElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  // Track if we've ever been streaming (to know if we need height locking)
  const wasStreamingRef = useRef(false);

  // Update wasStreamingRef when streaming changes
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
    }
  }, [isStreaming]);

  // Reset when message changes
  useEffect(() => {
    if (messageKey !== undefined && messageKey !== lastMessageKeyRef.current) {
      reset();
      lastMessageKeyRef.current = messageKey;
      lastTextLengthRef.current = 0;
      wasStreamingRef.current = false;
      // Reset height via requestAnimationFrame to avoid sync setState warning
      requestAnimationFrame(() => setLockedHeight(null));
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
      addText(text.slice(visibleText.length));
    }
  }, [isStreaming, text, visibleText.length, addText]);

  // Lock height when transitioning from streaming to non-streaming
  useLayoutEffect(() => {
    // Only lock height if we were streaming and now we're not
    if (!isStreaming && wasStreamingRef.current && lockedHeight === null && containerRef.current) {
      setLockedHeight(containerRef.current.offsetHeight);
    }
  }, [isStreaming, lockedHeight]);

  // Show cursor while streaming and animating
  const showCursor = isStreaming && !isComplete;

  // Determine what to show
  const displayText = isComplete || !isStreaming ? text : visibleText;

  // Show plain text during streaming, markdown otherwise
  const shouldShowMarkdown = !isStreaming;

  // Apply locked height as min-height to prevent shrinking
  const style = lockedHeight !== null
    ? { display: 'inline-block', minHeight: `${lockedHeight}px` }
    : undefined;

  return (
    <span ref={containerRef} style={style}>
      {shouldShowMarkdown ? (
        <span dangerouslySetInnerHTML={{ __html: formatMarkdown(displayText) }} />
      ) : (
        <span style={{ whiteSpace: 'pre-wrap' }}>{displayText}</span>
      )}
      {showCursor && <span className="streaming-cursor-smooth" />}
    </span>
  );
});
