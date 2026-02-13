import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const API_BASE_URL = 'http://localhost:3001';

interface CreateUserResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Supported languages for transcription
const TRANSCRIPTION_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'auto', name: 'Auto-detect' },
];

export function OnboardingPage() {
  const { theme, effectiveTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getLogoSrc = () => {
    if (theme === 'dark') return '/logo-dark.svg';
    if (theme === 'light') return '/logo-light.svg';
    return effectiveTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg';
  };

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
      const response = await fetch(`${API_BASE_URL}/api/setup/create-first-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          username,
          email,
          password,
          preferredLanguage,
        }),
      });

      const data: CreateUserResponse = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || 'Failed to create account');
        return;
      }

      // Success - redirect to login page
      navigate('/login', {
        state: { message: 'Account created successfully! Please sign in.' }
      });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
      <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 w-full max-w-lg shadow-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={getLogoSrc()} alt="Weft Logo" className="w-20 h-20" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
            Welcome to Weft
          </h1>
          <p className="text-text-secondary dark:text-text-dark-secondary">
            Create your account to get started
          </p>
        </div>

        {error && (
          <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-3 mb-4 text-danger text-sm text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
              disabled={isLoading}
              autoComplete="name"
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default placeholder:text-text-hint dark:placeholder:text-text-dark-hint transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="johndoe"
              disabled={isLoading}
              autoComplete="username"
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
              autoComplete="email"
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
              autoComplete="new-password"
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
              autoComplete="new-password"
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default placeholder:text-text-hint dark:placeholder:text-text-dark-hint transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="language" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">
              Transcription Language
            </label>
            <select
              id="language"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              disabled={isLoading}
              className="px-4 py-3 border border-border dark:border-border-dark rounded-lg text-base bg-white dark:bg-dark-700 text-text-default dark:text-text-dark-default transition-colors focus:outline-none focus:border-border-focus disabled:bg-neutral-100 dark:disabled:bg-dark-800 disabled:cursor-not-allowed"
            >
              {TRANSCRIPTION_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <small className="text-xs text-text-hint dark:text-text-dark-hint">
              This will be the default language for video transcriptions
            </small>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
