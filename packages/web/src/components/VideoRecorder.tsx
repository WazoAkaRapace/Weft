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

  // Ref for title input auto-focus
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Video Streamer Hook
  const {
    isRecording,
    isPaused,
    duration,
    bytesUploaded,
    error: recordingError,
    recordingState,
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

      // Success - call callback
      onSaveComplete?.();
    } catch (err) {
      console.error('Failed to save title:', err);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [journalId, title, validateTitle, onSaveComplete]);

  /**
   * Handle Enter key in title input
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSaving && title.trim()) {
      handleSaveTitle();
    }
  }, [isSaving, title, handleSaveTitle]);

  // ===== RENDER IDLE STATE =====
  if (uiState === 'idle') {
    return (
      <div className="recording-container">
        <div className="recording-idle">
          <h2>New Journal Entry</h2>
          <p>Record a video to add a new entry to your journal</p>
          <button
            className="recording-button start-button"
            onClick={handleStartRecording}
            aria-label="Start recording video"
          >
            Start Recording
          </button>
        </div>
      </div>
    );
  }

  // ===== RENDER RECORDING STATE =====
  if (uiState === 'recording') {
    return (
      <div className="recording-container">
        {recordingError && (
          <div className="recording-error" role="alert" aria-live="assertive">
            <span className="error-icon" aria-hidden="true">⚠</span>
            <span>
              {recordingError.message === 'Camera/microphone permission denied'
                ? 'Camera/microphone access denied. Please grant permissions and try again.'
                : recordingError.message}
            </span>
          </div>
        )}

        <div className="recording-active">
          {isRecording && !isPaused && (
            <div role="status" aria-live="polite" className="streaming-indicator">
              <span className="streaming-dot" aria-hidden="true"></span>
              <span className="streaming-text">STREAMING</span>
            </div>
          )}

          {isRecording && (
            <>
              <div className="timer-display" role="timer" aria-live="off">
                <div className="timer-value" aria-label={`Recording duration ${formatDuration(duration)}`}>
                  {formatDuration(duration)}
                </div>
                <div className="timer-label">Duration</div>
              </div>

              <div className="upload-progress" role="status" aria-live="polite">
                <span className="upload-label">Uploaded:</span>
                <span className="upload-value" aria-label={`${formatBytes(bytesUploaded)} uploaded`}>
                  {formatBytes(bytesUploaded)}
                </span>
              </div>
            </>
          )}

          <div className="recording-controls">
            {isRecording && !isPaused && (
              <>
                <button
                  className="recording-button pause-button"
                  onClick={handlePauseRecording}
                  aria-label="Pause recording"
                  aria-pressed="false"
                >
                  Pause
                </button>
                <button
                  className="recording-button stop-button"
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
                  className="recording-button resume-button"
                  onClick={handleResumeRecording}
                  aria-label="Resume recording"
                  aria-pressed="true"
                >
                  Resume
                </button>
                <button
                  className="recording-button stop-button"
                  onClick={handleStopRecording}
                  aria-label="Stop recording"
                >
                  Stop Recording
                </button>
              </>
            )}

            <button
              className="recording-button cancel-button"
              onClick={handleCancelRecording}
              aria-label="Cancel recording and discard"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDER COMPLETE STATE =====
  if (uiState === 'complete') {
    const isTitleValid = title.trim().length > 0 && title.trim().length <= 200;

    return (
      <div className="recording-container">
        <div className="recording-complete">
          <div className="complete-header">
            <div className="success-icon" role="img" aria-label="Recording completed successfully">
              ✓
            </div>
            <h2>Recording Complete!</h2>
            <p>Your video has been saved. Give it a title to finish.</p>
          </div>

          {saveError && (
            <div className="recording-error" role="alert" aria-live="assertive">
              <span className="error-icon" aria-hidden="true">⚠</span>
              <span>{saveError}</span>
            </div>
          )}

          <div className="title-input-group">
            <label htmlFor="journal-title">Journal Title</label>
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
              className={titleError ? 'error' : ''}
              placeholder="e.g., My Day at the Beach"
            />
            {titleError && (
              <span id="title-error" className="title-error" role="alert">
                {titleError}
              </span>
            )}
            {!titleError && (
              <span id="title-hint" className="title-hint">
                Enter a title for your journal entry (1-200 characters)
              </span>
            )}
          </div>

          <div className="recording-controls">
            <button
              className="save-button"
              onClick={handleSaveTitle}
              disabled={isSaving || !isTitleValid}
              aria-label="Save journal with title"
            >
              {isSaving ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              className="recording-button cancel-button"
              onClick={onCancel}
              aria-label="Cancel and return to dashboard"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
