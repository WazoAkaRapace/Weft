import { useState, useEffect, FormEvent } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UserSettings {
  preferredLanguage: string;
  transcriptionModel: string;
  email: string;
  name: string;
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

// Whisper model options with detailed descriptions
// Powered by whisper.cpp via @lumen-labs-dev/whisper-node
const WHISPER_MODELS = [
  {
    id: 'Xenova/whisper-tiny',
    name: 'Tiny (Multilingual)',
    description: 'Fastest, lowest accuracy. Best for quick drafts.',
    size: '~75MB / ~273MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-tiny.en',
    name: 'Tiny (English-only)',
    description: 'Fastest for English. Slightly better accuracy than multilingual.',
    size: '~75MB / ~273MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-base',
    name: 'Base (Multilingual)',
    description: 'Balanced speed and accuracy. Good default option.',
    size: '~142MB / ~388MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-base.en',
    name: 'Base (English-only)',
    description: 'Better accuracy for English than multilingual base.',
    size: '~142MB / ~388MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-small',
    name: 'Small (Multilingual)',
    description: 'Good accuracy, reasonable speed. Recommended for most users.',
    size: '~466MB / ~852MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-small.en',
    name: 'Small (English-only)',
    description: 'Best accuracy for English at this size.',
    size: '~466MB / ~852MB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-medium',
    name: 'Medium (Multilingual)',
    description: 'High accuracy, slower processing. Good for important recordings.',
    size: '~1.5GB / ~2.1GB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-medium.en',
    name: 'Medium (English-only)',
    description: 'High accuracy for English, faster than multilingual medium.',
    size: '~1.5GB / ~2.1GB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-large',
    name: 'Large V1 (Multilingual)',
    description: 'High accuracy, requires ~4GB RAM. First large model version.',
    size: '~2.9GB / ~3.9GB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-large-v2',
    name: 'Large V2 (Multilingual)',
    description: 'Improved accuracy over V1. Requires ~4GB RAM.',
    size: '~2.9GB / ~3.9GB RAM',
    warning: false,
  },
  {
    id: 'Xenova/whisper-large-v3',
    name: 'Large V3 Turbo (Multilingual) ⭐',
    description: 'Latest optimized model. Fastest large model with excellent accuracy. Requires ~4GB RAM.',
    size: '~1.5GB / ~3.9GB RAM',
    warning: false,
  },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    preferredLanguage: 'en',
    transcriptionModel: 'Xenova/whisper-small',
    email: '',
    name: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/user/settings`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }

        const data = await response.json();
        setSettings({
          preferredLanguage: data.preferredLanguage || 'en',
          transcriptionModel: data.transcriptionModel || 'Xenova/whisper-small',
          email: data.email || '',
          name: data.name || '',
        });
      } catch (err) {
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSettingsSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/user/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferredLanguage: settings.preferredLanguage,
          transcriptionModel: settings.transcriptionModel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);

    try {
      // Use Better Auth's built-in password change endpoint
      const response = await fetch(`${API_BASE}/api/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to change password');
      }

      // Clear form and show success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-neutral-500 dark:text-dark-400">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-50 mb-2">
          Settings
        </h1>
        <p className="text-neutral-600 dark:text-dark-400">
          Manage your account settings and preferences
        </p>
      </div>

      {error && (
        <div className="bg-error-light dark:bg-error/20 border border-error dark:border-error/50 rounded-lg p-4 mb-6 text-error text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-success-light dark:bg-success/20 border border-success dark:border-success/50 rounded-lg p-4 mb-6 text-success-dark text-sm">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Transcription Settings Section */}
        <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
            Transcription Settings
          </h2>

          <form onSubmit={handleSettingsSave} className="space-y-6">
            {/* Language Preference */}
            <div className="flex flex-col gap-2">
              <label htmlFor="language" className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                Transcription Language
              </label>
              <select
                id="language"
                value={settings.preferredLanguage}
                onChange={(e) => setSettings({ ...settings, preferredLanguage: e.target.value })}
                disabled={isSaving}
                className="px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg text-base bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {TRANSCRIPTION_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <small className="text-xs text-neutral-500 dark:text-dark-400">
                This will be the default language for video transcriptions
              </small>
            </div>

            {/* Transcription Model */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                Transcription Model
              </label>
              <p className="text-xs text-neutral-500 dark:text-dark-400">
                Powered by whisper.cpp. Larger models are more accurate but require more RAM. Large V3 (~4GB RAM) offers the best quality. First-time download may take several minutes for larger models.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {WHISPER_MODELS.map((model) => (
                  <label
                    key={model.id}
                    className={`
                      flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors
                      ${settings.transcriptionModel === model.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="transcriptionModel"
                      value={model.id}
                      checked={settings.transcriptionModel === model.id}
                      onChange={(e) => setSettings({ ...settings, transcriptionModel: e.target.value })}
                      disabled={isSaving}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-neutral-900 dark:text-dark-50">
                        {model.name}
                      </span>
                      <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1 mb-1">
                        {model.description}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-dark-500">
                        Size: {model.size}
                      </p>
                      {model.warning && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          ⚠️ Requires significant memory and may timeout on first download
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Transcription Settings'}
              </button>
            </div>
          </form>
        </section>

        {/* Password Change Section */}
        <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
            Change Password
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="currentPassword" className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter your current password"
                disabled={isChangingPassword}
                autoComplete="current-password"
                className="px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg text-base bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="newPassword" className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter your new password"
                disabled={isChangingPassword}
                minLength={8}
                autoComplete="new-password"
                className="px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg text-base bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your new password"
                disabled={isChangingPassword}
                minLength={8}
                autoComplete="new-password"
                className="px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg text-base bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {passwordError && (
              <div className="text-error text-sm">
                {passwordError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>

        {/* Account Info Section */}
        <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
            Account Information
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600 dark:text-dark-400">Name:</span>
              <span className="text-neutral-900 dark:text-dark-50 font-medium">{settings.name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600 dark:text-dark-400">Email:</span>
              <span className="text-neutral-900 dark:text-dark-50 font-medium">{settings.email}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
