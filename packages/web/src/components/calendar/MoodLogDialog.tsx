/**
 * MoodLogDialog Component
 * Modal for logging or editing daily mood
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { EmotionBadge } from '../emotions/EmotionBadge';
import type { DailyMood, MoodLogEntry, TimeOfDay } from './types';

interface JournalEntry {
  id: string;
  dominantEmotion?: string;
  createdAt: string;
}

interface MoodLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  timeOfDay: TimeOfDay;
  existingMood?: DailyMood | null;
  existingNotes?: string | null;
  journalEntries?: JournalEntry[];
  onSave: (entry: MoodLogEntry) => Promise<void>;
  onDelete?: () => Promise<void>;
  _isLoading?: boolean;
}

const MOOD_OPTIONS: { value: DailyMood; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😊', label: 'Happy' },
  { value: 'sad', emoji: '😢', label: 'Sad' },
  { value: 'angry', emoji: '😠', label: 'Angry' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'sick', emoji: '🤒', label: 'Sick' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'tired', emoji: '😴', label: 'Tired' },
  { value: 'excited', emoji: '🤩', label: 'Excited' },
  { value: 'fear', emoji: '😨', label: 'Fear' },
  { value: 'disgust', emoji: '🤢', label: 'Disgust' },
  { value: 'surprise', emoji: '😮', label: 'Surprise' },
];

export function MoodLogDialog({
  isOpen,
  onClose,
  date,
  timeOfDay,
  existingMood = null,
  existingNotes = null,
  journalEntries = [],
  onSave,
  onDelete,
  _isLoading = false,
}: MoodLogDialogProps) {
  const [mood, setMood] = useState<DailyMood | null>(existingMood);
  const [notes, setNotes] = useState(existingNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state with props when they change (e.g., after data fetch)
  useEffect(() => {
    setMood(existingMood);
    setNotes(existingNotes || '');
  }, [existingMood, existingNotes]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        date: format(date, 'yyyy-MM-dd'),
        mood,
        timeOfDay,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (error) {
      // Let error propagate but ensure loading state is cleared
      console.error('Failed to save mood:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const hasExistingMood = existingMood !== null && existingMood !== undefined;
  const timeOfDayLabel = timeOfDay === 'morning' ? 'Morning' : 'Afternoon';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mood-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md border border-neutral-200 dark:border-dark-600 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-600 shrink-0">
          <div>
            <h2 id="mood-dialog-title" className="text-xl font-semibold text-neutral-900 dark:text-dark-50">
              {hasExistingMood ? 'Edit Mood' : 'Log Mood'}
              <span className="text-sm font-normal text-neutral-500 dark:text-dark-400 ml-2">
                - {timeOfDayLabel}
              </span>
            </h2>
            <p className="text-sm text-neutral-500 dark:text-dark-400 mt-1">{formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-240px)] overflow-y-auto">
          {/* Journal Entries Section */}
          {journalEntries.length > 0 && (
            <div className="bg-neutral-50 dark:bg-dark-900/30 rounded-lg p-4 border border-neutral-200 dark:border-dark-600">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-dark-300 mb-3">
                Journal Entries ({journalEntries.length})
              </h3>
              <div className="space-y-2">
                {journalEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-neutral-600 dark:text-dark-400">
                      {format(new Date(entry.createdAt), 'h:mm a')}
                    </span>
                    {entry.dominantEmotion && (
                      <EmotionBadge emotion={entry.dominantEmotion} showLabel={false} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-dark-300 mb-3">
              How are you feeling?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                    ${
                      mood === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                    }
                  `}
                  aria-label={`Select ${option.label} mood`}
                  aria-pressed={mood === option.value}
                >
                  <span className="text-3xl" role="img" aria-label={option.label}>
                    {option.emoji}
                  </span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-dark-200">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="mood-notes" className="block text-sm font-medium text-neutral-700 dark:text-dark-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              id="mood-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any context about your mood..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-900 text-neutral-900 dark:text-dark-50 resize-none"
            />
            <p className="text-xs text-neutral-400 dark:text-dark-500 mt-1 text-right">
              {notes.length}/500
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-dark-600 shrink-0">
          {/* Delete Button */}
          {hasExistingMood && onDelete && (
            <div>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || isDeleting}
                  className="text-sm text-error hover:text-error-dark font-medium transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600 dark:text-dark-400">Delete mood?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-sm font-medium text-error hover:text-error-dark transition-colors disabled:opacity-50"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="text-sm text-neutral-600 dark:text-dark-400 hover:text-neutral-800 dark:hover:text-dark-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-dark-600 text-neutral-700 dark:text-dark-200 hover:bg-neutral-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 font-medium"
            >
              {isSaving ? 'Saving...' : hasExistingMood ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
