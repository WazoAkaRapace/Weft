/**
 * VideoRecorder Component
 *
 * A reusable video recording UI component with three states:
 * 1. Idle: "Start Recording" button
 * 2. Recording: Timer, upload progress, controls
 * 3. Complete: Title input, save button
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVideoStreamer } from '../hooks/useVideoStreamer';
import { useNotes } from '../hooks/useNotes';
import { RecordingNotePanel } from './recording/RecordingNotePanel';
import { NoteSelector } from './notes/NoteSelector';
import { MDXEditor } from '@mdxeditor/editor';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  tablePlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
} from '@mdxeditor/editor';
import type { StreamCompleteResponse } from '@weft/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type RecorderUIState = 'idle' | 'recording' | 'complete';

export interface VideoRecorderProps {
  /** Callback when save is complete */
  onSaveComplete?: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
}

export function VideoRecorder({ onSaveComplete, onCancel }: VideoRecorderProps) {
  // UI State
  const [uiState, setUiState] = useState<RecorderUIState>('idle');
  const [journalId, setJournalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Note selection state
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [notePanelCollapsed, setNotePanelCollapsed] = useState(true);
  const [showNoteSelector, setShowNoteSelector] = useState(false);

  // Get full note objects for display
  const { notes } = useNotes();
  const selectedNotes = notes.filter((note) => selectedNoteIds.includes(note.id));

  // Ref for title input auto-focus
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Video Streamer Hook
  const {
    isRecording,
    isPaused,
    duration,
    bytesUploaded,
    error: recordingError,
    mediaStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    formatDuration,
    formatBytes,
  } = useVideoStreamer({
    onComplete: (result: StreamCompleteResponse) => {
      setJournalId(result.journalId);
      setUiState('complete');
    },
    onError: (error) => {
      console.error('Recording error:', error);
    },
  });

  // Auto-focus title input when entering complete state
  useEffect(() => {
    if (uiState === 'complete' && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [uiState]);

  /**
   * Start recording - transition to recording state
   */
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
      setUiState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [startRecording]);

  /**
   * Stop recording - transition to complete state
   */
  const handleStopRecording = useCallback(async () => {
    try {
      await stopRecording();
      // onComplete callback will handle transition to complete state
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }, [stopRecording]);

  /**
   * Pause recording
   */
  const handlePauseRecording = useCallback(() => {
    pauseRecording();
  }, [pauseRecording]);

  /**
   * Resume recording
   */
  const handleResumeRecording = useCallback(() => {
    resumeRecording();
  }, [resumeRecording]);

  /**
   * Cancel recording and cleanup
   */
  const handleCancelRecording = useCallback(async () => {
    await cancelRecording();
    onCancel?.();
  }, [cancelRecording, onCancel]);

  /**
   * Handle title input change
   */
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    // Clear error when user starts typing
    if (titleError) {
      setTitleError('');
    }
    // Clear save error when user modifies title
    if (saveError) {
      setSaveError('');
    }
  }, [titleError, saveError]);

  /**
   * Validate title input
   */
  const validateTitle = useCallback((value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Please enter a title (1-200 characters)';
    }
    if (trimmed.length > 200) {
      return 'Title must be 200 characters or less';
    }
    return '';
  }, []);

  /**
   * Save journal title
   */
  const handleSaveTitle = useCallback(async () => {
    // Validate title
    const error = validateTitle(title);
    if (error) {
      setTitleError(error);
      return;
    }

    if (!journalId) {
      setSaveError('Journal ID not found. Please try recording again.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const response = await fetch(`${API_BASE}/api/journals/${journalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to save journal title');
      }

      // Link selected notes to the journal
      if (selectedNoteIds.length > 0) {
        await Promise.all(
          selectedNoteIds.map(noteId =>
            fetch(`${API_BASE}/api/notes/${noteId}/journals/${journalId}`, {
              method: 'POST',
              credentials: 'include',
            })
          )
        );
      }

      // Success - call callback
      onSaveComplete?.();
    } catch (err) {
      console.error('Failed to save title:', err);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [journalId, title, validateTitle, onSaveComplete, selectedNoteIds]);

  /**
   * Handle Enter key in title input
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSaving && title.trim()) {
      handleSaveTitle();
    }
  }, [isSaving, title, handleSaveTitle]);

  const isTitleValid = title.trim().length > 0 && title.trim().length <= 200;

  // Note selector modal (available in all states)
  return (
    <>
      {uiState === 'idle' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 w-full max-w-md shadow-lg text-center">
            <h2 className="text-xl text-text-default dark:text-text-dark-default mb-2">New Journal Entry</h2>
            <p className="text-text-secondary dark:text-text-dark-secondary mb-4">Record a video to add a new entry to your journal</p>

            {/* Note selection */}
            <button
              onClick={() => setShowNoteSelector(true)}
              className="mb-6 px-4 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
            >
              {selectedNoteIds.length > 0
                ? `${selectedNoteIds.length} note${selectedNoteIds.length > 1 ? 's' : ''} selected`
                : 'Select notes to link'}
            </button>

            <button
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover"
              onClick={handleStartRecording}
              aria-label="Start recording video"
            >
              Start Recording
            </button>
          </div>

          <RecordingNotePanel
            selectedNoteIds={selectedNoteIds}
            onSelectionChange={setSelectedNoteIds}
            isCollapsed={notePanelCollapsed}
            onToggleCollapse={() => setNotePanelCollapsed(!notePanelCollapsed)}
          />
        </div>
      )}

      {uiState === 'recording' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
          <div className="w-full max-w-4xl">
            {recordingError && (
              <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-4 mb-4 text-danger text-sm flex items-center gap-2" role="alert" aria-live="assertive">
                <span className="text-lg" aria-hidden="true">⚠</span>
                <span>
                  {recordingError.message === 'Camera/microphone permission denied'
                    ? 'Camera/microphone access denied. Please grant permissions and try again.'
                    : recordingError.message}
                </span>
              </div>
            )}

            <div className="bg-white dark:bg-background-card-dark rounded-lg shadow-lg overflow-hidden">
              {mediaStream && (
                <video
                  className="w-full bg-black"
                  autoPlay
                  muted
                  playsInline
                  ref={(videoElement) => {
                    if (videoElement && videoElement.srcObject !== mediaStream) {
                      videoElement.srcObject = mediaStream;
                    }
                  }}
                />
              )}

              {isRecording && !isPaused && (
                <div role="status" aria-live="polite" className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 text-white px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true"></span>
                  <span className="text-sm font-medium">STREAMING</span>
                </div>
              )}

              <div className="p-4 space-y-4">
                {isRecording && (
                  <>
                    <div className="timer-display flex justify-between items-center p-3 bg-background dark:bg-background-dark rounded-lg" role="timer" aria-live="off">
                      <div className="text-sm text-text-secondary dark:text-text-dark-secondary">Duration</div>
                      <div className="timer-value text-xl font-mono font-medium text-text-default dark:text-text-dark-default" aria-label={`Recording duration ${formatDuration(duration)}`}>
                        {formatDuration(duration)}
                      </div>
                    </div>

                    <div className="upload-progress flex justify-between items-center p-3 bg-background dark:bg-background-dark rounded-lg" role="status" aria-live="polite">
                      <span className="upload-label text-sm text-text-secondary dark:text-text-dark-secondary">Uploaded:</span>
                      <span className="upload-value text-sm font-medium text-text-default dark:text-text-dark-default" aria-label={`${formatBytes(bytesUploaded)} uploaded`}>
                        {formatBytes(bytesUploaded)}
                      </span>
                    </div>
                  </>
                )}

                <div className="recording-controls flex gap-2 justify-center">
                  {isRecording && !isPaused && (
                    <>
                      <button
                        className="px-4 py-2 bg-warning text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-warning-hover"
                        onClick={handlePauseRecording}
                        aria-label="Pause recording"
                        aria-pressed="false"
                      >
                        Pause
                      </button>
                      <button
                        className="px-4 py-2 bg-danger text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-danger-hover"
                        onClick={handleStopRecording}
                        aria-label="Stop recording"
                      >
                        Stop Recording
                      </button>
                    </>
                  )}

                  {isRecording && isPaused && (
                    <>
                      <button
                        className="px-4 py-2 bg-success text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-success-hover"
                        onClick={handleResumeRecording}
                        aria-label="Resume recording"
                        aria-pressed="true"
                      >
                        Resume
                      </button>
                      <button
                        className="px-4 py-2 bg-danger text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-danger-hover"
                        onClick={handleStopRecording}
                        aria-label="Stop recording"
                      >
                        Stop Recording
                      </button>
                    </>
                  )}

                  <button
                    className="px-4 py-2 bg-text-secondary dark:bg-text-dark-secondary text-white rounded-lg font-medium cursor-pointer transition-colors hover:opacity-80"
                    onClick={handleCancelRecording}
                    aria-label="Cancel recording and discard"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {/* Notes display section during recording */}
            {selectedNotes.length > 0 && (
              <div className="mt-4 bg-white dark:bg-background-card-dark rounded-lg shadow-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-default dark:text-text-dark-default flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Linked Notes ({selectedNotes.length})
                  </h3>
                  <button
                    onClick={() => setShowNoteSelector(true)}
                    className="text-xs px-2 py-1 border border-border dark:border-border-dark rounded hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-neutral-50 dark:bg-dark-700 rounded-lg border-l-4"
                      style={{ borderLeftColor: note.color || '#94a3b8' }}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg flex-shrink-0">{note.icon}</span>
                        <h4 className="font-medium text-text-default dark:text-text-dark-default text-sm">
                          {note.title}
                        </h4>
                      </div>
                      {note.content && (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <MDXEditor
                            key={note.id}
                            markdown={note.content}
                            contentEditableClassName="prose max-w-none dark:prose-invert"
                            plugins={[
                              directivesPlugin({
                                directiveDescriptors: [AdmonitionDirectiveDescriptor],
                              }),
                              headingsPlugin(),
                              listsPlugin(),
                              quotePlugin(),
                              thematicBreakPlugin(),
                              linkPlugin(),
                              tablePlugin(),
                            ]}
                            readOnly={true}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <RecordingNotePanel
            selectedNoteIds={selectedNoteIds}
            onSelectionChange={setSelectedNoteIds}
            isCollapsed={notePanelCollapsed}
            onToggleCollapse={() => setNotePanelCollapsed(!notePanelCollapsed)}
          />
        </div>
      )}

      {uiState === 'complete' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-background-dark">
          <div className="bg-white dark:bg-background-card-dark rounded-lg p-8 w-full max-w-md shadow-lg">
            <div className="text-center mb-6">
              <div className="success-icon w-12 h-12 bg-success-light dark:bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4" role="img" aria-label="Recording completed successfully">
                <span className="text-success text-2xl">✓</span>
              </div>
              <h2 className="text-xl text-text-default dark:text-text-dark-default mb-2">Recording Complete!</h2>
              <p className="text-text-secondary dark:text-text-dark-secondary">Your video has been saved. Give it a title to finish.</p>
            </div>

            {saveError && (
              <div className="bg-danger-light dark:bg-danger/20 border border-danger dark:border-danger/50 rounded-lg p-3 mb-4 text-danger text-sm flex items-center gap-2" role="alert" aria-live="assertive">
                <span aria-hidden="true">⚠</span>
                <span>{saveError}</span>
              </div>
            )}

            <div className="title-input-group flex flex-col gap-2 mb-6">
              <label htmlFor="journal-title" className="text-sm font-medium text-text-muted dark:text-text-dark-muted">Journal Title</label>
              <input
                ref={titleInputRef}
                id="journal-title"
                type="text"
                value={title}
                onChange={handleTitleChange}
                onKeyDown={handleKeyDown}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'title-error' : 'title-hint'}
                maxLength={200}
                className={`px-4 py-3 border rounded-lg text-base transition-colors focus:outline-none focus:border-border-focus ${
                  titleError
                    ? 'border-danger dark:border-danger'
                    : 'border-border dark:border-border-dark'
                }`}
                placeholder="e.g., My Day at the Beach"
              />
              {titleError && (
                <span id="title-error" className="text-danger text-sm" role="alert">
                  {titleError}
                </span>
              )}
              {!titleError && (
                <span id="title-hint" className="text-xs text-text-hint dark:text-text-dark-hint">
                  Enter a title for your journal entry (1-200 characters)
                </span>
              )}
            </div>

            {/* Note selection */}
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-medium text-text-muted dark:text-text-dark-muted">Linked Notes</label>
              <button
                type="button"
                className="w-full px-4 py-3 border border-border dark:border-border-dark rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors"
                onClick={() => setShowNoteSelector(true)}
              >
                {selectedNoteIds.length > 0
                  ? `${selectedNoteIds.length} note${selectedNoteIds.length > 1 ? 's' : ''} selected`
                  : 'Select notes to link'}
              </button>
            </div>

            <div className="recording-controls flex gap-2">
              <button
                className="save-button flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleSaveTitle}
                disabled={isSaving || !isTitleValid}
                aria-label="Save journal with title"
              >
                {isSaving ? 'Saving...' : 'Save Entry'}
              </button>
              <button
                className="px-6 py-3 bg-white dark:bg-background-card-dark text-text-secondary dark:text-text-dark-secondary border border-border dark:border-border-dark rounded-lg font-medium cursor-pointer transition-colors hover:bg-background dark:hover:bg-background-dark"
                onClick={onCancel}
                aria-label="Cancel and return to dashboard"
              >
                Cancel
              </button>
            </div>
          </div>

          <RecordingNotePanel
            selectedNoteIds={selectedNoteIds}
            onSelectionChange={setSelectedNoteIds}
            isCollapsed={notePanelCollapsed}
            onToggleCollapse={() => setNotePanelCollapsed(!notePanelCollapsed)}
          />
        </div>
      )}

      <NoteSelector
        isOpen={showNoteSelector}
        onClose={() => setShowNoteSelector(false)}
        selectedNoteIds={selectedNoteIds}
        onSelectionChange={setSelectedNoteIds}
      />
    </>
  );
}
