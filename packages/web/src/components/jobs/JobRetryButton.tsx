/**
 * JobRetryButton Component
 * Styled button for retrying failed jobs.
 * Blue for transcription, purple for emotion.
 */


interface JobRetryButtonProps {
  type: 'transcription' | 'emotion';
  onRetry: () => void;
  isRetrying: boolean;
  disabled?: boolean;
  className?: string;
}

export function JobRetryButton({
  type,
  onRetry,
  isRetrying,
  disabled = false,
  className = '',
}: JobRetryButtonProps) {
  const getButtonStyles = () => {
    if (type === 'transcription') {
      return 'bg-primary-light dark:bg-primary/20 text-primary dark:text-primary hover:bg-primary hover:text-white';
    }
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/50';
  };

  const getLabelText = () => {
    if (type === 'transcription') {
      return isRetrying ? 'Retrying...' : '🔄 Retry Transcription';
    }
    return isRetrying ? 'Analyzing...' : '😊 Retry Emotion';
  };

  return (
    <button
      onClick={onRetry}
      disabled={disabled || isRetrying}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-all disabled:opacity-60 disabled:cursor-not-allowed ${getButtonStyles()} ${className}`}
      title={type === 'transcription' ? 'Retry transcription' : 'Retry emotion analysis'}
    >
      {isRetrying && (
        <svg className="inline-block animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {getLabelText()}
    </button>
  );
}
