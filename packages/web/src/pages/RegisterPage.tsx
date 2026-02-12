import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { authClient } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';

const API_BASE_URL = 'http://localhost:3001';

interface CheckUsersResponse {
  hasUsers: boolean;
}

export function RegisterPage() {
  const { theme, effectiveTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isCheckingUsers, setIsCheckingUsers] = useState(true);

  const getLogoSrc = () => {
    if (theme === 'dark') return '/logo-dark.svg';
    if (theme === 'light') return '/logo-light.svg';
    return effectiveTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg';
  };

  useEffect(() => {
    const checkUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/setup/check-users`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data: CheckUsersResponse = await response.json();
          setHasUsers(data.hasUsers);
        } else {
          setHasUsers(false);
        }
      } catch (error) {
        console.error('Failed to check users:', error);
        setHasUsers(false);
      } finally {
        setIsCheckingUsers(false);
      }
    };

    checkUsers();
  }, []);

  // Show loading while checking if users exist
  if (isCheckingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
        <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 w-full max-w-md shadow-lg text-center">
          <div className="flex justify-center mb-6">
            <img src={getLogoSrc()} alt="Weft Logo" className="w-20 h-20" />
          </div>
          <p className="text-text-secondary dark:text-text-dark-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If users already exist, redirect to login
  if (hasUsers) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (error) {
        setError(error.message || 'Failed to sign up');
        return;
      }

      // Redirect to dashboard on successful registration
      navigate('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
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
          Join Weft
        </h1>
        <p className="text-text-secondary dark:text-text-dark-secondary text-center mb-6">
          Create your account
        </p>

        {error && (
          <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-3 mb-4 text-danger text-sm text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              disabled={isLoading}
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default placeholder:text-text-hint dark:placeholder:text-text-dark-hint transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            />
          </div>

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

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-text-secondary dark:text-text-dark-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
