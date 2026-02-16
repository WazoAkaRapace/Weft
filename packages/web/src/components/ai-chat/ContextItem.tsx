import type { ContextItem } from '../../hooks/useAIChat';
import { ThemeIcon } from '../ui/ThemeIcon';

interface ContextItemProps {
  item: ContextItem;
  onRemove: () => void;
}

export function ContextItemComponent({ item, onRemove }: ContextItemProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return '';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getPreview = (content?: string) => {
    if (!content) return 'No content available';
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  };

  return (
    <div className="group flex items-start justify-between p-3 bg-neutral-50 dark:bg-dark-700 rounded-lg border border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <ThemeIcon
            name={item.type === 'journal' ? 'recording' : 'note'}
            alt={item.type === 'journal' ? 'Journal' : 'Note'}
            size={34}
          />
          <span className="font-medium text-neutral-900 dark:text-dark-100 truncate">
            {item.title}
          </span>
        </div>

        {item.date && (
          <p className="text-xs text-neutral-500 dark:text-dark-400 mb-1">
            {formatDate(item.date)}
          </p>
        )}

        {item.content && (
          <p className="text-sm text-neutral-600 dark:text-dark-400 line-clamp-2">
            {getPreview(item.content)}
          </p>
        )}
      </div>

      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 text-neutral-400 hover:text-error dark:hover:text-error-light opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-neutral-200 dark:hover:bg-dark-600"
        title="Remove from context"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
