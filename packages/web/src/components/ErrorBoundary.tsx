/**
 * Error Boundary Components
 *
 * Provides React Error Boundaries for graceful error handling and recovery.
 * These components catch JavaScript errors anywhere in the child component tree,
 * log those errors, and display a fallback UI.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

/**
 * Props for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Root Error Boundary
 *
 * Catches errors in the entire application and displays a fallback UI.
 * Provides a reset button to attempt recovery.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if resetKeys changed
    if (hasError && resetKeys && prevProps.resetKeys) {
      if (resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <DefaultErrorFallback
          error={error}
          onReset={this.reset}
        />
      );
    }

    return children;
  }
}

/**
 * Props for DefaultErrorFallback component
 */
interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps): ReactNode {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6 text-center">
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 mb-4 text-red-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          An unexpected error occurred. Please try again.
        </p>

        {/* Error Details (Development only) */}
        {isDev && error && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-700 rounded text-xs overflow-auto max-h-40 text-red-600 dark:text-red-400">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Props for RouteErrorBoundary component
 */
interface RouteErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Route-level Error Boundary
 *
 * For use at route boundaries to catch errors in specific routes.
 * Displays a simpler error UI suitable for partial page errors.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    if (process.env.NODE_ENV !== 'production') {
      console.error('[RouteErrorBoundary] Error in route:', error);
      console.error('[RouteErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <RouteErrorFallback
          error={error}
          onReset={this.reset}
        />
      );
    }

    return children;
  }
}

/**
 * Route-level error fallback
 */
function RouteErrorFallback({ error, onReset }: DefaultErrorFallbackProps): ReactNode {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-red-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
            Failed to load content
          </h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            {error?.message || 'An error occurred while loading this section.'}
          </p>

          {isDev && error?.stack && (
            <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/50 rounded text-xs overflow-auto max-h-32 text-red-700 dark:text-red-300">
              {error.stack}
            </pre>
          )}

          <button
            onClick={onReset}
            className="mt-3 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for programmatically resetting an error boundary
 * To be used with error boundaries that expose reset functionality
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useErrorBoundary() {
  const resetErrorBoundary = () => {
    // Navigate to home to reset the app state
    window.location.href = '/';
  };

  return { resetErrorBoundary };
}
