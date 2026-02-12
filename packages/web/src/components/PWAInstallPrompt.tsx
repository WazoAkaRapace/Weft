/**
 * PWA Install Prompt Component
 *
 * Shows a floating install prompt when the PWA is available for installation.
 * Appears as a compact toast-style notification.
 */

import { useState } from 'react';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallPromptProps {
  /**
   * Whether to show the prompt automatically when installable
   */
  autoShow?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

export function PWAInstallPrompt({
  autoShow = true,
  className = '',
}: PWAInstallPromptProps) {
  const { canInstall, isInstalled, install } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Don't show if already installed, can't install, or user dismissed
  if (isInstalled || !canInstall || isDismissed || !autoShow) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    const accepted = await install();
    if (!accepted) {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage to not show again for a while
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        max-w-xs
        bg-white dark:bg-neutral-800
        text-neutral-900 dark:text-white
        shadow-lg rounded-xl
        border border-neutral-200 dark:border-neutral-700
        p-3 flex items-center gap-3
        animate-slide-up
        ${className}
      `}
      role="banner"
      aria-label="Install app prompt"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
        <img
          src="/icons/icon-72x72.png"
          alt="Weft"
          className="w-8 h-8 rounded"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">Install Weft</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          Add to home screen
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className="
            px-3 py-1.5 text-xs font-medium
            bg-teal-600 text-white
            rounded-lg hover:bg-teal-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
          aria-label="Install app"
        >
          {isInstalling ? '...' : 'Install'}
        </button>
      </div>
    </div>
  );
}

/**
 * Compact install button for headers/toolbars
 */
export function PWAInstallButton({ className = '' }: { className?: string }) {
  const { canInstall, isInstalled, install } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);

  if (isInstalled || !canInstall) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className={`
        flex items-center gap-2 px-3 py-1.5
        text-sm font-medium
        bg-teal-600 text-white
        rounded-lg hover:bg-teal-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
      aria-label="Install app"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {isInstalling ? 'Installing...' : 'Install'}
    </button>
  );
}
