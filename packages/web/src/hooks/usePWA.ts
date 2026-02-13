/**
 * PWA Installation Hook
 *
 * Provides functionality to handle the "Add to Home Screen" prompt
 * and track PWA installation status.
 */

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallState {
  /**
   * Whether the app can be installed (beforeinstallprompt event was fired)
   */
  canInstall: boolean;

  /**
   * Whether the app is currently installed
   */
  isInstalled: boolean;

  /**
   * Whether the installation prompt is currently showing
   */
  isPromptShowing: boolean;

  /**
   * The deferred beforeinstallprompt event
   */
  deferredPrompt: BeforeInstallPromptEvent | null;
}

interface UsePWAReturn extends PWAInstallState {
  /**
   * Trigger the install prompt
   * Returns true if the user accepted, false otherwise
   */
  install: () => Promise<boolean>;

  /**
   * Check if the app is running in standalone mode (installed PWA)
   */
  checkIfInstalled: () => boolean;
}

/**
 * Hook for handling PWA installation
 *
 * @example
 * ```tsx
 * const { canInstall, isInstalled, install } = usePWA();
 *
 * if (canInstall && !isInstalled) {
 *   return <button onClick={install}>Install App</button>;
 * }
 * ```
 */
export function usePWA(): UsePWAReturn {
  /**
   * Check if the app is running in standalone mode
   */
  const checkIfInstalled = useCallback((): boolean => {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check iOS Safari
    const isIOSStandalone = ('standalone' in window.navigator) &&
      (window.navigator as Navigator & { standalone: boolean }).standalone;

    return isStandalone || !!isIOSStandalone;
  }, []);

  // Use lazy initializer to compute initial installed state
  const [state, setState] = useState<PWAInstallState>(() => ({
    canInstall: false,
    isInstalled: checkIfInstalled(),
    isPromptShowing: false,
    deferredPrompt: null,
  }));

  /**
   * Trigger the install prompt
   */
  const install = useCallback(async (): Promise<boolean> => {
    if (!state.deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return false;
    }

    setState((prev) => ({ ...prev, isPromptShowing: true }));

    try {
      // Show the prompt
      await state.deferredPrompt.prompt();

      // Wait for the user's response
      const { outcome } = await state.deferredPrompt.userChoice;

      console.log('[PWA] User response:', outcome);

      if (outcome === 'accepted') {
        setState((prev) => ({
          ...prev,
          canInstall: false,
          isInstalled: true,
          isPromptShowing: false,
          deferredPrompt: null,
        }));
        return true;
      }

      setState((prev) => ({ ...prev, isPromptShowing: false }));
      return false;
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      setState((prev) => ({ ...prev, isPromptShowing: false }));
      return false;
    }
  }, [state.deferredPrompt]);

  useEffect(() => {
    // Listen for the beforeinstallprompt event (only if not already installed)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      e.preventDefault();

      const promptEvent = e as BeforeInstallPromptEvent;

      setState((prev) => ({
        ...prev,
        canInstall: true,
        deferredPrompt: promptEvent,
      }));
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App was installed');
      setState((prev) => ({
        ...prev,
        canInstall: false,
        isInstalled: true,
        deferredPrompt: null,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkIfInstalled]);

  return {
    ...state,
    install,
    checkIfInstalled,
  };
}

/**
 * Check if the device supports PWA installation
 */
export function isPWASupported(): boolean {
  return 'serviceWorker' in navigator;
}
