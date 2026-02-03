import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NavigationContextValue {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (has: boolean) => void;
  navigateWithWarning: (callback: () => void) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const navigateWithWarning = useCallback((callback: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => callback);
      setShowWarning(true);
    } else {
      callback();
    }
  }, [hasUnsavedChanges]);

  const handleConfirm = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowWarning(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  const handleCancel = useCallback(() => {
    setShowWarning(false);
    setPendingNavigation(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, navigateWithWarning }}>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-2">
              Unsaved Changes
            </h2>
            <p className="text-sm text-neutral-600 dark:text-dark-400 mb-6">
              You have unsaved changes. Do you really want to leave? Your changes will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-dark-300 bg-neutral-100 dark:bg-dark-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-dark-600 transition-colors"
              >
                Stay on this page
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-error rounded-lg hover:bg-error-dark transition-colors"
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
}
