interface RagStatusIndicatorProps {
  isIndexing: boolean;
  className?: string;
}

/**
 * Small inline indicator that appears briefly during/after save
 * to show that the RAG search index is being updated.
 */
export function RagStatusIndicator({ isIndexing, className = '' }: RagStatusIndicatorProps) {
  if (!isIndexing) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-neutral-500 dark:text-dark-400 ${className}`}
      title="Updating search index..."
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="animate-spin"
      >
        <circle cx="12" cy="12" r="10" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      <span className="hidden sm:inline">Indexing...</span>
    </div>
  );
}
