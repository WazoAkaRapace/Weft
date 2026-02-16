import { useRef, useEffect, useState, useCallback } from 'react';

interface UseSmoothStreamOptions {
  /** Characters per second to reveal (default: 200) */
  charsPerSecond?: number;
  /** Minimum time between updates in ms (default: 16 for ~60fps) */
  minUpdateInterval?: number;
}

interface UseSmoothStreamReturn {
  /** Currently visible (animated) text */
  visibleText: string;
  /** Add new text to the buffer */
  addText: (text: string) => void;
  /** Reset the stream state */
  reset: () => void;
  /** Whether the animation has caught up to the buffer */
  isComplete: boolean;
  /** Total buffered text (for reference) */
  bufferedText: string;
}

/**
 * Hook for smooth character-by-character text streaming animation.
 * Uses requestAnimationFrame for 60fps smooth animation.
 * Decouples network arrival from visual animation.
 */
export function useSmoothStream(options: UseSmoothStreamOptions = {}): UseSmoothStreamReturn {
  const { charsPerSecond = 200, minUpdateInterval = 16 } = options;

  // Use refs for animation state to avoid re-renders per character
  const bufferRef = useRef<string>('');
  const visibleIndexRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // React state - only updated when text actually changes
  const [visibleText, setVisibleText] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(true);
  const [bufferedText, setBufferedText] = useState<string>('');

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    const elapsed = timestamp - lastUpdateTimeRef.current;
    const bufferLength = bufferRef.current.length;
    const currentIndex = visibleIndexRef.current;

    // Check if we need to update
    if (currentIndex < bufferLength) {
      // Calculate how many characters to reveal based on elapsed time
      const msPerChar = 1000 / charsPerSecond;
      const charsToReveal = Math.floor(elapsed / msPerChar);

      if (charsToReveal > 0 || elapsed >= minUpdateInterval) {
        // Reveal at least 1 character if enough time has passed
        const newChars = Math.max(1, charsToReveal);
        visibleIndexRef.current = Math.min(currentIndex + newChars, bufferLength);
        lastUpdateTimeRef.current = timestamp;

        // Update React state
        const newVisibleText = bufferRef.current.slice(0, visibleIndexRef.current);
        setVisibleText(newVisibleText);
        setIsComplete(visibleIndexRef.current >= bufferLength);
      }

      // Continue animation if there's more to reveal
      if (visibleIndexRef.current < bufferLength) {
        // eslint-disable-next-line react-hooks/immutability -- recursive animation requires self-reference
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    } else {
      setIsComplete(true);
    }
  }, [charsPerSecond, minUpdateInterval]);

  // Add text to buffer
  const addText = useCallback((text: string) => {
    if (!text) return;

    const wasComplete = visibleIndexRef.current >= bufferRef.current.length;
    bufferRef.current += text;
    setBufferedText(bufferRef.current);
    setIsComplete(false);

    // Start animation if it wasn't running
    if (wasComplete || animationFrameRef.current === null) {
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // Reset state
  const reset = useCallback(() => {
    bufferRef.current = '';
    visibleIndexRef.current = 0;
    lastUpdateTimeRef.current = 0;
    setVisibleText('');
    setBufferedText('');
    setIsComplete(true);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    visibleText,
    addText,
    reset,
    isComplete,
    bufferedText,
  };
}

/**
 * Hook for managing smooth streaming across multiple messages.
 * Tracks which message is currently streaming and resets animation state when it changes.
 */
export function useMessageStream(
  messageId: string | number,
  content: string,
  isStreaming: boolean,
  options?: UseSmoothStreamOptions
) {
  const { visibleText, addText, reset, isComplete } = useSmoothStream(options);
  const lastMessageIdRef = useRef<string | number>(messageId);
  const lastContentLengthRef = useRef<number>(0);

  // Reset when message ID changes
  useEffect(() => {
    if (messageId !== lastMessageIdRef.current) {
      reset();
      lastMessageIdRef.current = messageId;
      lastContentLengthRef.current = 0;
    }
  }, [messageId, reset]);

  // Add new content as it arrives
  useEffect(() => {
    if (content.length > lastContentLengthRef.current) {
      const newContent = content.slice(lastContentLengthRef.current);
      addText(newContent);
      lastContentLengthRef.current = content.length;
    }
  }, [content, addText]);

  // When streaming ends, show all content immediately
  useEffect(() => {
    if (!isStreaming && content.length > visibleText.length) {
      // Streaming ended but animation hasn't caught up - skip to end
      addText(content.slice(visibleText.length));
    }
  }, [isStreaming, content, visibleText.length, addText]);

  return {
    visibleText: isComplete || !isStreaming ? content : visibleText,
    isAnimating: !isComplete && isStreaming,
  };
}
