import { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useJournalDetail } from '../hooks/useJournalDetail';
import { useJobStatus } from '../hooks/useJobStatus';
import { VideoPlayer } from '../components/video/VideoPlayer';
import { TranscriptDisplay } from '../components/transcript/TranscriptDisplay';
import { NotesEditor, type NotesEditorRef } from '../components/notes/NotesEditor';
import { EmotionDisplay } from '../components/emotions/EmotionDisplay';
import { JobStatusIndicator, JobRetryButton } from '../components/jobs';
import { LinkedNotesList } from '../components/journal/LinkedNotesList';
import { NoteViewModal } from '../components/notes/NoteViewModal';
import { NoteSelector } from '../components/notes/NoteSelector';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatDuration } from '../lib/video-stream';
import type { Transcript, Note } from '@weft/shared';

export function JournalDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const editorRef = useRef<NotesEditorRef>(null);

  // Linked notes state
  const [linkedNotes, setLinkedNotes] = useState<Note[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [selectedNoteForModal, setSelectedNoteForModal] = useState<Note | null>(null);
  const [showNoteSelector, setShowNoteSelector] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { journal, isLoading, error, updateNotes, refresh, setJournal } = useJournalDetail(
    id || ''
  );

  const {
    jobStatus,
    retryTranscription,
    retryEmotion,
    isRetryingTranscription,
    isRetryingEmotion,
  } = useJobStatus(id || '');

  // Track previous job status to detect when jobs complete
  const prevJobStatusRef = useRef(jobStatus);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Fetch only transcript data
  const fetchTranscript = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/journals/${id}/transcript`, {
        credentials: 'include',
      });

      if (response.ok) {
        const transcriptData = (await response.json()) as Transcript;
        setJournal((prev) => (prev ? { ...prev, transcript: transcriptData } : prev));
      }
    } catch (err) {
      console.error('Failed to fetch transcript:', err);
    }
  }, [id, setJournal]);

  // Fetch only journal (emotion) data
  const fetchEmotionData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/journals/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const journalData = (await response.json()) as typeof journal;
        setJournal((prev) =>
          prev
            ? {
                ...prev,
                dominantEmotion: journalData.dominantEmotion,
                emotionTimeline: journalData.emotionTimeline,
                emotionScores: journalData.emotionScores,
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Failed to fetch emotion data:', err);
    }
  }, [id, setJournal]);

  // Update only the section that changed when jobs complete
  useEffect(() => {
    const prev = prevJobStatusRef.current;

    // Check if transcription job just completed
    const transcriptionJustCompleted =
      prev.transcription?.status !== 'completed' &&
      jobStatus.transcription?.status === 'completed';

    // Check if emotion job just completed
    const emotionJustCompleted =
      prev.emotion?.status !== 'completed' &&
      jobStatus.emotion?.status === 'completed';

    // Update only the data that changed
    if (transcriptionJustCompleted) {
      fetchTranscript();
    }
    if (emotionJustCompleted) {
      fetchEmotionData();
    }

    // Update ref for next comparison
    prevJobStatusRef.current = jobStatus;
  }, [jobStatus, fetchTranscript, fetchEmotionData]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      if (editorRef.current) {
        await editorRef.current.save();
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }
  }, [isSaving]);

  const handleSegmentClick = useCallback((startTime: number) => {
    setSeekTo(startTime);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  // Fetch linked notes
  const fetchLinkedNotes = useCallback(async () => {
    if (!id) return;
    setIsNotesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/journals/${id}/notes`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLinkedNotes(data.notes);
      }
    } catch (err) {
      console.error('Failed to fetch linked notes:', err);
    } finally {
      setIsNotesLoading(false);
    }
  }, [id]);

  // Link a note to the journal
  const handleLinkNote = useCallback(async (noteId: string) => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}/journals/${id}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        await fetchLinkedNotes();
      }
    } catch (err) {
      console.error('Failed to link note:', err);
    }
  }, [id, fetchLinkedNotes]);

  // Unlink a note from the journal
  const handleUnlinkNote = useCallback(async (noteId: string) => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}/journals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setLinkedNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err) {
      console.error('Failed to unlink note:', err);
    }
  }, [id]);

  // Delete journal
  const handleDelete = useCallback(async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/api/journals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        // Navigate back to history after successful deletion
        navigate('/history');
      } else {
        console.error('Failed to delete journal');
        setIsDeleting(false);
      }
    } catch (err) {
      console.error('Failed to delete journal:', err);
      setIsDeleting(false);
    }
  }, [id, navigate]);

  // Fetch linked notes when journal loads
  useEffect(() => {
    if (id && journal) {
      fetchLinkedNotes();
    }
  }, [id, journal, fetchLinkedNotes]);

  // Handle journal not found
  if (!isLoading && error?.message === 'Journal not found') {
    return (
      <div className="p-8 max-w-7xl mx-auto">
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
      </div>
    );
  }

  // Handle access denied
  if (!isLoading && error?.message === 'Access denied') {
    return (
      <div className="p-8 max-w-7xl mx-auto">
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
      </div>
    );
  }

  // Handle other errors
  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
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
      </div>
    );
  }

  // Loading state
  if (isLoading || !journal) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-background-card-dark rounded-lg p-16 shadow-sm text-center text-text-secondary dark:text-text-dark-secondary">
          Loading journal...
        </div>
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
    <div className="p-8 max-w-7xl mx-auto">
        {/* Header with back button and delete button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-transparent text-primary dark:text-primary border border-primary rounded-lg cursor-pointer transition-all hover:bg-primary-light"
          >
            ← Back to History
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="px-4 py-2 bg-danger text-white rounded-lg font-medium cursor-pointer transition-colors hover:bg-danger-hover disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Entry
              </>
            )}
          </button>
        </div>

        {/* Page title */}
        <h1 className="text-3xl font-bold text-text-default dark:text-text-dark-default mb-8">
          {journal.title}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
          {/* Left column: Video and Transcript */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
              <VideoPlayer
                videoPath={journal.videoPath}
                thumbnailPath={journal.thumbnailPath}
                duration={journal.duration}
                onTimeUpdate={handleTimeUpdate}
                seekTo={seekTo}
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

            {/* Emotion Detection */}
            {/* Job Status Indicator */}
            <JobStatusIndicator
              type="emotion"
              status={jobStatus.emotion?.status || null}
              error={jobStatus.emotion?.error}
              onRetry={retryEmotion}
              isRetrying={isRetryingEmotion}
            />

            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text-default dark:text-text-dark-default">Emotion Analysis</h3>
                <JobRetryButton
                  type="emotion"
                  onRetry={retryEmotion}
                  isRetrying={isRetryingEmotion}
                  disabled={jobStatus.emotion?.status === 'processing' || jobStatus.emotion?.status === 'pending'}
                />
              </div>
              <EmotionDisplay
                journalId={journal.id}
                duration={journal.duration}
              />
            </div>

            {/* Linked Notes */}
            <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text-default dark:text-text-dark-default">Linked Notes</h3>
                <button
                  onClick={() => setShowNoteSelector(true)}
                  className="px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover"
                >
                  + Link Note
                </button>
              </div>
              <LinkedNotesList
                journalId={id || ''}
                notes={linkedNotes}
                onUnlink={handleUnlinkNote}
                onNoteClick={setSelectedNoteForModal}
                isLoading={isNotesLoading}
              />
            </div>

            {/* Transcript */}
            {/* Job Status Indicator */}
            <JobStatusIndicator
              type="transcription"
              status={jobStatus.transcription?.status || null}
              error={jobStatus.transcription?.error}
              onRetry={retryTranscription}
              isRetrying={isRetryingTranscription}
            />

            {journal.transcript ? (
              <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text-default dark:text-text-dark-default">Transcript</h3>
                  <JobRetryButton
                    type="transcription"
                    onRetry={retryTranscription}
                    isRetrying={isRetryingTranscription}
                    disabled={jobStatus.transcription?.status === 'processing' || jobStatus.transcription?.status === 'pending'}
                  />
                </div>
                <TranscriptDisplay
                  transcript={journal.transcript}
                  onSegmentClick={handleSegmentClick}
                  currentTime={currentTime}
                />
              </div>
            ) : (
              // Only show "not available" message if not processing
              !jobStatus.transcription?.status && (
                <div className="bg-white dark:bg-background-card-dark rounded-lg p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-text-default dark:text-text-dark-default">Transcript</h3>
                    <JobRetryButton
                      type="transcription"
                      onRetry={retryTranscription}
                      isRetrying={isRetryingTranscription}
                    />
                  </div>
                  <div className="text-center py-8 text-text-secondary dark:text-text-dark-secondary">
                    <p>Transcript not available yet</p>
                    <p className="text-sm text-text-hint dark:text-text-dark-hint mt-2">
                      Transcription is in progress or has not started.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Right column: Notes */}
          <div className="flex flex-col">
            <div className="bg-white dark:bg-background-card-dark rounded-lg shadow-sm h-full flex flex-col">
              {/* Notes header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border dark:border-border-dark">
                <h2 className="text-lg sm:text-xl font-semibold text-text-default dark:text-text-dark-default">Notes</h2>
                <div className="flex items-center gap-2">
                  {/* Edit/View toggle */}
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title={isEditing ? 'View mode' : 'Edit mode'}
                  >
                    {isEditing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    )}
                  </button>
                  {/* Save button - only show when editing */}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        saveStatus === 'saved'
                          ? 'bg-success text-white'
                          : saveStatus === 'error'
                          ? 'bg-danger text-white'
                          : 'bg-primary text-white hover:bg-primary-hover'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      title={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Failed' : 'Save'}
                    >
                      {saveStatus === 'saved' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span className="hidden sm:inline">Saved</span>
                        </>
                      ) : saveStatus === 'saving' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                            <circle cx="12" cy="12" r="10" opacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                          <span className="hidden sm:inline">Saving...</span>
                        </>
                      ) : saveStatus === 'error' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          <span className="hidden sm:inline">Failed</span>
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                          </svg>
                          <span className="hidden sm:inline">Save</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 p-4 sm:p-6">
                <NotesEditor
                  ref={editorRef}
                  notes={journal.notes}
                  onSave={updateNotes}
                  isEditing={isEditing}
                  isSaving={isSaving}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <NoteViewModal
          note={selectedNoteForModal}
          isOpen={selectedNoteForModal !== null}
          onClose={() => setSelectedNoteForModal(null)}
        />

        {showNoteSelector && (
          <NoteSelector
            selectedNoteIds={linkedNotes.map(n => n.id)}
            onSelectionChange={(noteIds) => {
              // For each newly selected note, link it to the journal
              const newNoteIds = noteIds.filter(id => !linkedNotes.some(n => n.id === id));
              Promise.all(newNoteIds.map(id => handleLinkNote(id)));
            }}
            excludeIds={linkedNotes.map(n => n.id)}
            isOpen={showNoteSelector}
            onClose={() => setShowNoteSelector(false)}
          />
        )}

        {/* Delete confirmation dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Journal Entry?"
          message={`Are you sure you want to delete "${journal.title}"? This action cannot be undone. The video and all associated data will be permanently deleted. Linked notes will not be deleted.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDestructive={true}
        />
      </div>
    );
}
