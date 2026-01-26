import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  isLoading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export function useInfiniteScroll({
  isLoading,
  hasNextPage,
  onLoadMore,
  threshold = 0.1,
}: UseInfiniteScrollOptions) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isLoading) {
          onLoadMore();
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasNextPage, isLoading, onLoadMore, threshold]);

  return observerTarget;
}
