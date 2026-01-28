import { useNavigate } from 'react-router-dom';
import { useSession, signOut } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';

export function DashboardPage() {
  const { data: session } = useSession();
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

  return (
    <div className="min-h-screen bg-background text-text-default dark:bg-background-dark dark:text-text-dark-default">
      <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl text-text-default dark:text-text-dark-default">Weft Dashboard</h1>
        </div>
        <div className="flex-1 flex justify-center gap-3">
          <button
            onClick={() => navigate('/record')}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover"
          >
            + New Recording
          </button>
          <button
            onClick={() => navigate('/history')}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover"
          >
            View History
          </button>
        </div>
        <div className="flex-1 flex items-center justify-end gap-4">
          <span className="font-medium text-text-muted dark:text-text-dark-muted">
            {session?.user?.name || 'User'}
          </span>
          <button
            onClick={cycleTheme}
            className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={`Current theme: ${theme}${theme === 'system' ? ` (${effectiveTheme})` : ''}`}
          >
            {getThemeIcon()}
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-transparent text-text-secondary dark:text-text-dark-secondary border border-border dark:border-border-dark rounded-lg cursor-pointer transition-all hover:bg-background dark:hover:bg-background-dark"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
            Welcome to Weft
          </h2>
          <p className="text-text-secondary dark:text-text-dark-secondary">
            Your video journaling application
          </p>
        </div>
      </main>
    </div>
  );
}
