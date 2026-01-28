import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useJournalDetail } from '../hooks/useJournalDetail';
import { VideoPlayer } from '../components/video/VideoPlayer';
import { TranscriptDisplay } from '../components/transcript/TranscriptDisplay';
import { NotesEditor } from '../components/notes/NotesEditor';
import { useTheme } from '../contexts/ThemeContext';
import { formatDuration } from '../lib/video-stream';

export function JournalDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(0);

  const { journal, isLoading, error, updateNotes, refresh } = useJournalDetail(
    id || ''
  );

  const handleSegmentClick = useCallback((startTime: number) => {
    setCurrentTime(startTime);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    return '💻';
  };

  // Handle journal not found
  if (!isLoading && error?.message === 'Journal not found') {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark">
        <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
          <button onClick={handleBack} className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light">
            ← Back to History
          </button>
          <button onClick={cycleTheme} className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {getThemeIcon()}
          </button>
        </header>
        <main className="p-8 max-w-7xl mx-auto">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center">
            <h2 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
              Journal not found
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-8">
              The journal you're looking for doesn't exist or you don't have access to it.
            </p>
            <button onClick={handleBack} className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover">
              Go back to history
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Handle access denied
  if (!isLoading && error?.message === 'Access denied') {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark">
        <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
          <button onClick={handleBack} className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light">
            ← Back to History
          </button>
          <button onClick={cycleTheme} className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {getThemeIcon()}
          </button>
        </header>
        <main className="p-8 max-w-7xl mx-auto">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center">
            <h2 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
              Access denied
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-8">
              You don't have permission to view this journal.
            </p>
            <button onClick={handleBack} className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover">
              Go back to history
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Handle other errors
  if (error) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark">
        <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
          <button onClick={handleBack} className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light">
            ← Back to History
          </button>
          <button onClick={cycleTheme} className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {getThemeIcon()}
          </button>
        </header>
        <main className="p-8 max-w-7xl mx-auto">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center">
            <h2 className="text-2xl text-text-default dark:text-text-dark-default mb-2">
              Error loading journal
            </h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-8">
              {error.message}
            </p>
            <button onClick={refresh} className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover">
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Loading state
  if (isLoading || !journal) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark">
        <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
          <button onClick={handleBack} className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light">
            ← Back to History
          </button>
          <h1 className="text-2xl text-text-default dark:text-text-dark-default flex-1 text-center">
            Loading...
          </h1>
          <button onClick={cycleTheme} className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {getThemeIcon()}
          </button>
        </header>
        <main className="p-8 max-w-7xl mx-auto">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center text-text-secondary dark:text-text-dark-secondary">
            Loading journal...
          </div>
        </main>
      </div>
    );
  }

  const journalDate = new Date(journal.createdAt);
  const formattedDate = journalDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <header className="bg-white dark:bg-background-card-dark px-8 py-4 shadow-sm flex justify-between items-center gap-4">
        <button onClick={handleBack} className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light">
          ← Back to History
        </button>
        <div className="flex-1 flex flex-col items-center gap-1">
          <h1 className="text-2xl text-text-default dark:text-text-dark-default text-center">
            {journal.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-text-muted dark:text-text-dark-muted">
            {session?.user?.name || 'User'}
          </span>
          <button onClick={cycleTheme} className="px-3 py-2 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {getThemeIcon()}
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
          {/* Left column: Video and Transcript */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
              <VideoPlayer
                videoPath={journal.videoPath}
                thumbnailPath={journal.thumbnailPath}
                duration={journal.duration}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            {/* Video metadata */}
            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-gray-700 last:border-0">
                <span className="font-medium text-text-secondary dark:text-text-dark-secondary">
                  Duration:
                </span>
                <span className="text-text-default dark:text-text-dark-default">
                  {formatDuration(journal.duration)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-gray-700 last:border-0">
                <span className="font-medium text-text-secondary dark:text-text-dark-secondary">
                  Date:
                </span>
                <span className="text-text-default dark:text-text-dark-default">
                  {formattedDate}
                </span>
              </div>
              {journal.location && (
                <div className="flex justify-between items-center py-3">
                  <span className="font-medium text-text-secondary dark:text-text-dark-secondary">
                    Location:
                  </span>
                  <span className="text-text-default dark:text-text-dark-default">
                    📍 {journal.location}
                  </span>
                </div>
              )}
            </div>

            {/* Transcript */}
            {journal.transcript ? (
              <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
                <TranscriptDisplay
                  transcript={journal.transcript}
                  onSegmentClick={handleSegmentClick}
                  currentTime={currentTime}
                />
              </div>
            ) : (
              <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
                <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
                  <p>Transcript not available yet</p>
                  <p className="text-sm text-text-hint dark:text-text-dark-hint mt-2">
                    Transcription is in progress or has not started.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right column: Notes */}
          <div className="flex flex-col">
            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm h-full">
              <NotesEditor
                notes={journal.notes}
                onSave={updateNotes}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
