import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, signOut } from '../../lib/auth';
import { useTheme } from '../../contexts/ThemeContext';
import { navigationStructure, NavItem, NavGroup } from '../../lib/navigation';
import { NoteTree } from '../notes/NoteTree';

interface SidebarProps {
  mode?: 'navigation' | 'notes-tree';
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'items' in item;
}

function NavigationSidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: Omit<SidebarProps, 'mode'>) {
  const { data: session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, effectiveTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login';
        },
      },
    });
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    return '💻'; // system
  };

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  return (
    <aside
      className={`
        h-screen bg-white dark:bg-dark-800 border-r border-neutral-200 dark:border-dark-600
        flex flex-col
        fixed md:relative z-50
        transition-all duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isCollapsed ? 'group hover:w-64' : ''}
      `}
    >
      {/* Logo/Brand */}
      <div className="p-4 border-b border-neutral-200 dark:border-dark-600 flex items-center justify-between">
        {!isCollapsed && (
          <h1 className="text-lg font-bold text-neutral-900 dark:text-dark-50">
            Weft
          </h1>
        )}
        {isCollapsed && (
          <span className="text-xl font-bold text-neutral-900 dark:text-dark-50">
            W
          </span>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigationStructure.map((item, index) => {
          if (isNavGroup(item)) {
            return (
              <div key={`group-${index}`} className="mb-2">
                {/* Group Header */}
                <div className={`${isCollapsed ? 'px-2' : 'px-4'} mb-2`}>
                  <span className={`text-xs font-semibold text-neutral-500 dark:text-dark-400 uppercase tracking-wide transition-opacity duration-200 ${
                    isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
                  }`}>
                    {item.title}
                  </span>
                </div>

                {/* Group Items */}
                {item.items.map((groupItem, groupIndex) => (
                  <button
                    key={`group-item-${groupIndex}`}
                    onClick={() => {
                      navigate(groupItem.path);
                      if (window.innerWidth < 768) {
                        onClose();
                      }
                    }}
                    className={`
                      w-full flex items-center gap-3 rounded-lg cursor-pointer mx-2
                      hover:bg-neutral-100 dark:hover:bg-dark-700
                      transition-all
                      ${isActive(groupItem.path)
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500'
                        : ''
                      }
                      ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}
                    `}
                    title={groupItem.label}
                  >
                    <span className="text-lg flex-shrink-0">{groupItem.icon}</span>
                    <span
                      className={`text-neutral-700 dark:text-dark-200 transition-opacity duration-200 ${
                        isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
                      }`}
                    >
                      {groupItem.label}
                    </span>
                  </button>
                ))}
              </div>
            );
          }

          // Top-level item
          return (
            <button
              key={`item-${index}`}
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth < 768) {
                  onClose();
                }
              }}
              className={`
                w-full flex items-center gap-3 rounded-lg cursor-pointer mx-2
                hover:bg-neutral-100 dark:hover:bg-dark-700
                transition-all
                ${isActive(item.path)
                  ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-500'
                  : ''
                }
                ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}
              `}
              title={item.label}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span
                className={`text-neutral-700 dark:text-dark-200 transition-opacity duration-200 ${
                  isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-neutral-200 dark:border-dark-600">
        {/* User Info */}
        <div
          className={`flex items-center gap-3 py-3 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors mx-2 rounded-lg ${
            isCollapsed ? 'px-2' : 'px-4'
          }`}
          title={session?.user?.name || 'User'}
        >
          <span className="text-lg flex-shrink-0">👤</span>
          <span
            className={`text-neutral-700 dark:text-dark-200 font-medium transition-opacity duration-200 ${
              isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
            }`}
          >
            {session?.user?.name || 'User'}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className={`
            w-full flex items-center gap-3 text-left hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors mx-2 rounded-lg
            ${isCollapsed ? 'px-2 py-2' : 'px-4 py-2'}
          `}
          title={`Current theme: ${theme}${theme === 'system' ? ` (${effectiveTheme})` : ''}`}
        >
          <span className="text-lg flex-shrink-0">{getThemeIcon()}</span>
          <span
            className={`text-neutral-700 dark:text-dark-200 transition-opacity duration-200 ${
              isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
            }`}
          >
            Theme
          </span>
        </button>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className={`
            w-full flex items-center gap-3 text-left text-error hover:bg-error-light/50 dark:hover:bg-error-dark-light/30 transition-colors mx-2 rounded-lg
            ${isCollapsed ? 'px-2 py-2' : 'px-4 py-2'}
          `}
          title="Sign Out"
        >
          <span className="text-lg flex-shrink-0">🚪</span>
          <span
            className={`transition-opacity duration-200 ${
              isCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap overflow-hidden' : ''
            }`}
          >
            Sign Out
          </span>
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="md:hidden w-full px-4 py-3 flex items-center justify-center gap-2 text-neutral-500 dark:text-dark-400 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors border-t border-neutral-200 dark:border-dark-600"
        >
          <span>✕</span>
          <span>Close</span>
        </button>

        {/* Desktop Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-full px-4 py-3 items-center justify-center gap-2 text-neutral-500 dark:text-dark-400 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors border-t border-neutral-200 dark:border-dark-600"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function NotesTreeSidebar({ isOpen, isCollapsed }: { isOpen: boolean; isCollapsed: boolean }) {
  return (
    <aside
      className={`
        h-screen bg-white dark:bg-dark-800 border-r border-neutral-200 dark:border-dark-600
        flex flex-col
        fixed md:relative z-50
        transition-all duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isCollapsed ? 'group hover:w-64' : ''}
      `}
    >
      <NoteTree isCollapsed={isCollapsed} />
    </aside>
  );
}

export function Sidebar({ mode = 'navigation', ...props }: SidebarProps) {
  if (mode === 'notes-tree') {
    return <NotesTreeSidebar isOpen={props.isOpen} isCollapsed={props.isCollapsed} />;
  }

  return <NavigationSidebar {...props} />;
}
