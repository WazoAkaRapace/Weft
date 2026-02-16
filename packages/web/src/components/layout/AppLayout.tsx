import { useState, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface LayoutContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isNotesMode: boolean;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components -- Context hook needs to be exported alongside provider
export function useLayoutContext() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within AppLayout');
  }
  return context;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Detect if we're in notes mode
  const isNotesMode = location.pathname.startsWith('/notes');

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, isNotesMode }}>
      <div className="flex h-screen bg-neutral-50 dark:bg-dark-900">
        <Sidebar
          isNotesMode={isNotesMode}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-x-hidden overflow-auto">
          {/* Mobile menu button - attached to left edge, hidden when drawer is open */}
          {!sidebarOpen && (
            <button
              className="md:hidden fixed top-1/2 -translate-y-1/2 left-0 z-50 p-1.5 bg-white dark:bg-dark-700 rounded-r-lg shadow-md hover:bg-neutral-100 dark:hover:bg-dark-600 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-neutral-900 dark:text-dark-50"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          {children}
        </main>
      </div>
    </LayoutContext.Provider>
  );
}
