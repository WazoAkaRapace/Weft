/**
 * JobStatusIndicator Component
 * Displays job status with spinner for pending/processing jobs,
 * error message with retry button for failed jobs,
 * and hides for completed jobs.
 */

import type { JobStatusType } from '../../hooks/useJobStatus';

interface JobStatusIndicatorProps {
  type: 'transcription' | 'emotion';
  status: JobStatusType;
  error?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function JobStatusIndicator({
  type,
  status,
  error,
  onRetry,
  isRetrying = false,
  className = '',
}: JobStatusIndicatorProps) {
  // Don't render anything if completed or null
  if (status === 'completed' || status === null) {
    return null;
  }

  const getLabelText = () => {
    if (status === 'pending') {
      return type === 'transcription' ? 'Queued for transcription...' : 'Queued for emotion analysis...';
    }
    if (status === 'processing') {
      return type === 'transcription' ? 'Transcribing...' : 'Analyzing emotions...';
    }
    if (status === 'failed') {
      return error || (type === 'transcription' ? 'Transcription failed' : 'Emotion analysis failed');
    }
    return '';
  };

  const getBgColor = () => {
    if (status === 'failed') {
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    }
    return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  };

  const getTextColor = () => {
    if (status === 'failed') {
      return 'text-red-700 dark:text-red-300';
    }
    return 'text-blue-700 dark:text-blue-300';
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()} ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {(status === 'pending' || status === 'processing') && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {getLabelText()}
          </span>
        </div>

        {status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  );
}
