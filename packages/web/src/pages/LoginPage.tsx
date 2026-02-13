import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authClient, useSession } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';
import { getApiUrl } from '../lib/config';

interface CheckUsersResponse {
  hasUsers: boolean;
}

export function LoginPage() {
  const { theme, effectiveTheme } = useTheme();
  const navigate = useNavigate();
  const { refetch } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    const checkUsers = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/setup/check-users`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data: CheckUsersResponse = await response.json();
          setHasUsers(data.hasUsers);
        } else {
          setHasUsers(false);
        }
      } catch {
        setHasUsers(false);
      }
    };

    checkUsers();
  }, []);

  const getLogoSrc = () => {
    if (theme === 'dark') return '/logo-dark.svg';
    if (theme === 'light') return '/logo-light.svg';
    return effectiveTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg';
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: '/dashboard',
      });

      if (signInError) {
        setError(signInError.message || 'Failed to sign in');
        setIsLoading(false);
        return;
      }

      // Refetch session to ensure it's updated before navigation
      await refetch();

      // Small delay to ensure session is properly set
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
      <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 w-full max-w-md shadow-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={getLogoSrc()} alt="Weft Logo" className="w-20 h-20" />
        </div>

        <h1 className="text-2xl text-text-default dark:text-text-dark-default text-center mb-2">
          Welcome to Weft
        </h1>
        <p className="text-text-secondary dark:text-text-dark-secondary text-center mb-6">
          Sign in to your account
        </p>

        {error && (
          <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-3 mb-4 text-danger text-sm text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              disabled={isLoading}
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default placeholder:text-text-hint dark:placeholder:text-text-dark-hint transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={isLoading}
              minLength={8}
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default placeholder:text-text-hint dark:placeholder:text-text-dark-hint transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {hasUsers === false && (
          <div className="text-center mt-6 text-sm text-text-secondary dark:text-text-dark-secondary">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
