import { useState, useEffect, FormEvent, useRef } from 'react';
import type {
  RestoreSummary,
  RestoreStrategy,
  BackupJobStatus,
} from '@weft/shared';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { NotificationSettings } from '../components/notifications/NotificationSettings';
import { getApiUrl } from '../lib/config';

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

  // Backup states
  const [backupStatus, setBackupStatus] = useState<'idle' | 'creating' | 'ready' | 'error'>('idle');
  const [backupProgress, setBackupProgress] = useState({ currentStep: '', percentage: 0 });
  const [backupJobId, setBackupJobId] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const backupPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<RestoreStrategy>('merge');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'restoring' | 'success' | 'error'>('idle');
  const [restoreProgress, setRestoreProgress] = useState({ currentStep: '', percentage: 0 });
  const [restoreResult, setRestoreResult] = useState<RestoreSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const restorePollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/user/settings`, {
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
      } catch {
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
      const response = await fetch(`${getApiUrl()}/api/user/settings`, {
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
      const response = await fetch(`${getApiUrl()}/api/auth/password`, {
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

  // Backup creation handler
  const handleCreateBackup = async () => {
    setBackupStatus('creating');
    setBackupProgress({ currentStep: 'Initializing...', percentage: 0 });
    setBackupError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create backup');
      }

      const data = await response.json();
      setBackupJobId(data.jobId);
      startBackupPolling(data.jobId);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to create backup');
      setBackupStatus('error');
    }
  };

  // Poll backup job status
  const startBackupPolling = (jobId: string) => {
    if (backupPollIntervalRef.current) {
      clearInterval(backupPollIntervalRef.current);
    }

    backupPollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/backup/status/${jobId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to check backup status');
        }

        const data: BackupJobStatus = await response.json();

        if (data.progress) {
          setBackupProgress({
            currentStep: data.progress.currentStep,
            percentage: data.progress.percentage,
          });
        }

        if (data.status === 'completed') {
          setBackupStatus('ready');
          stopBackupPolling();
        } else if (data.status === 'failed') {
          setBackupError(data.error || 'Backup failed');
          setBackupStatus('error');
          stopBackupPolling();
        }
      } catch (err) {
        setBackupError(err instanceof Error ? err.message : 'Failed to check backup status');
        setBackupStatus('error');
        stopBackupPolling();
      }
    }, 1000);
  };

  const stopBackupPolling = () => {
    if (backupPollIntervalRef.current) {
      clearInterval(backupPollIntervalRef.current);
      backupPollIntervalRef.current = null;
    }
  };

  // Download backup handler
  const handleDownloadBackup = async () => {
    if (!backupJobId) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/backup/download/${backupJobId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weft-backup-${new Date().toISOString().split('T')[0]}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reset backup state after successful download
      setBackupStatus('idle');
      setBackupJobId(null);
      setBackupProgress({ currentStep: '', percentage: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download backup');
    }
  };

  // Restore handler
  const handleRestore = async () => {
    if (!restoreFile) return;

    // Show warning for replace strategy
    if (restoreStrategy === 'replace' && !showReplaceWarning) {
      setShowReplaceWarning(true);
      return;
    }

    setShowReplaceWarning(false);
    setRestoreStatus('restoring');
    setRestoreProgress({ currentStep: 'Initializing...', percentage: 0 });
    setRestoreError(null);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('strategy', restoreStrategy);

      const response = await fetch(`${getApiUrl()}/api/restore`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to restore backup');
      }

      const data = await response.json();
      startRestorePolling(data.jobId);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore backup');
      setRestoreStatus('error');
    }
  };

  // Poll restore job status
  const startRestorePolling = (jobId: string) => {
    if (restorePollIntervalRef.current) {
      clearInterval(restorePollIntervalRef.current);
    }

    restorePollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/restore/status/${jobId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to check restore status');
        }

        const data: BackupJobStatus = await response.json();

        if (data.progress) {
          setRestoreProgress({
            currentStep: data.progress.currentStep,
            percentage: data.progress.percentage,
          });
        }

        if (data.status === 'completed') {
          setRestoreStatus('success');
          setRestoreResult(data.result || null);
          stopRestorePolling();
          // Reset file after successful restore
          setRestoreFile(null);
        } else if (data.status === 'failed') {
          setRestoreError(data.error || 'Restore failed');
          setRestoreStatus('error');
          stopRestorePolling();
        }
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : 'Failed to check restore status');
        setRestoreStatus('error');
        stopRestorePolling();
      }
    }, 1000);
  };

  const stopRestorePolling = () => {
    if (restorePollIntervalRef.current) {
      clearInterval(restorePollIntervalRef.current);
      restorePollIntervalRef.current = null;
    }
  };

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      stopBackupPolling();
      stopRestorePolling();
    };
  }, []);

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

        {/* Notifications Section */}
        <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
            Notifications
          </h2>
          <NotificationSettings />
        </section>

        {/* Data Management Section */}
        <section className="bg-white dark:bg-dark-800 rounded-lg p-6 border border-neutral-200 dark:border-dark-600">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-50 mb-4">
            Data Management
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-400 mb-6">
            Create backups of your journal entries and notes, or restore from a previous backup.
          </p>

          <div className="space-y-8">
            {/* Backup Subsection */}
            <div>
              <h3 className="text-md font-medium text-neutral-900 dark:text-dark-50 mb-3">
                Create Backup
              </h3>
              <p className="text-sm text-neutral-600 dark:text-dark-400 mb-4">
                Download a complete backup of all your journals, notes, and media files.
              </p>

              {backupStatus === 'idle' && (
                <button
                  onClick={handleCreateBackup}
                  className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                >
                  Create Backup
                </button>
              )}

              {backupStatus === 'creating' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
                    <span className="text-sm text-neutral-600 dark:text-dark-400">
                      Creating backup...
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600 dark:text-dark-400">{backupProgress.currentStep}</span>
                      <span className="text-neutral-900 dark:text-dark-50 font-medium">{backupProgress.percentage}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-dark-600 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${backupProgress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {backupStatus === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-success text-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Backup ready for download
                  </div>
                  <button
                    onClick={handleDownloadBackup}
                    className="px-6 py-2 bg-success hover:bg-success/90 text-white rounded-lg font-medium transition-colors"
                  >
                    Download Backup
                  </button>
                </div>
              )}

              {backupStatus === 'error' && (
                <div className="space-y-3">
                  <div className="text-error text-sm">
                    {backupError}
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 dark:border-dark-600"></div>

            {/* Restore Subsection */}
            <div>
              <h3 className="text-md font-medium text-neutral-900 dark:text-dark-50 mb-3">
                Restore from Backup
              </h3>
              <p className="text-sm text-neutral-600 dark:text-dark-400 mb-4">
                Upload a backup file to restore your journals and notes.
              </p>

              <div className="space-y-4">
                {/* File Input */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="restoreFile" className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                    Select Backup File
                  </label>
                  <input
                    id="restoreFile"
                    type="file"
                    accept=".tar.gz"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    disabled={restoreStatus === 'restoring'}
                    className="px-4 py-3 border border-neutral-300 dark:border-dark-600 rounded-lg text-base bg-white dark:bg-dark-700 text-neutral-900 dark:text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                </div>

                {/* Restore Strategy Selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                    Restore Strategy
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreStrategy"
                        value="merge"
                        checked={restoreStrategy === 'merge'}
                        onChange={(e) => setRestoreStrategy(e.target.value as RestoreStrategy)}
                        disabled={restoreStatus === 'restoring'}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-neutral-900 dark:text-dark-50">Merge</span>
                        <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1">
                          Keep existing data, add imported data. Conflicts will be resolved by keeping the most recent version.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreStrategy"
                        value="skip"
                        checked={restoreStrategy === 'skip'}
                        onChange={(e) => setRestoreStrategy(e.target.value as RestoreStrategy)}
                        disabled={restoreStatus === 'restoring'}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-neutral-900 dark:text-dark-50">Skip Conflicts</span>
                        <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1">
                          Only import data that doesn't conflict with existing entries.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreStrategy"
                        value="replace"
                        checked={restoreStrategy === 'replace'}
                        onChange={(e) => setRestoreStrategy(e.target.value as RestoreStrategy)}
                        disabled={restoreStatus === 'restoring'}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-medium text-neutral-900 dark:text-dark-50">Replace</span>
                        <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1">
                          Delete all current data before restoring. This action cannot be undone.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Restore Progress */}
                {restoreStatus === 'restoring' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
                      <span className="text-sm text-neutral-600 dark:text-dark-400">
                        Restoring backup...
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-600 dark:text-dark-400">{restoreProgress.currentStep}</span>
                        <span className="text-neutral-900 dark:text-dark-50 font-medium">{restoreProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-dark-600 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${restoreProgress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Restore Success */}
                {restoreStatus === 'success' && restoreResult && (
                  <div className="bg-success-light dark:bg-success/20 border border-success dark:border-success/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-success-dark text-sm font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Backup restored successfully!
                    </div>
                    <div className="text-sm text-neutral-700 dark:text-dark-200 space-y-1">
                      <div>Journals restored: {restoreResult.journalsRestored}</div>
                      <div>Notes restored: {restoreResult.notesRestored}</div>
                      <div>Files restored: {restoreResult.filesRestored}</div>
                      {restoreResult.conflictsResolved > 0 && (
                        <div>Conflicts resolved: {restoreResult.conflictsResolved}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Restore Error */}
                {restoreStatus === 'error' && (
                  <div className="text-error text-sm">
                    {restoreError}
                  </div>
                )}

                {/* Restore Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleRestore}
                    disabled={!restoreFile || restoreStatus === 'restoring'}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {restoreStatus === 'restoring' ? 'Restoring...' : 'Restore Backup'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Replace Warning Dialog */}
        <ConfirmDialog
          isOpen={showReplaceWarning}
          title="Replace All Data?"
          message="This will delete all your current journals, notes, and media files before restoring from the backup. This action cannot be undone. Are you sure you want to continue?"
          confirmLabel="Yes, Replace All"
          cancelLabel="Cancel"
          onConfirm={() => {
            setShowReplaceWarning(false);
            handleRestore();
          }}
          onCancel={() => setShowReplaceWarning(false)}
          isDestructive={true}
        />
      </div>
    </div>
  );
}
