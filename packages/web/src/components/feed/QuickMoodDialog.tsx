/**
 * QuickMoodDialog Component
 * Simplified mood logging dialog for dashboard quick entry
 */

import { useState } from 'react';
import { format } from 'date-fns';
import type { TimeOfDay } from '@weft/shared';

const MOOD_OPTIONS = [
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
] as const;

interface QuickMoodDialogProps {
  isOpen: boolean;
  timeOfDay: TimeOfDay;
  onClose: () => void;
  onSave: (mood: string, notes: string | null) => void;
  isLoading: boolean;
}

export function QuickMoodDialog({ isOpen, timeOfDay, onClose, onSave, isLoading }: QuickMoodDialogProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (selectedMood) {
      onSave(selectedMood, notes.trim() || null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getTimeLabel = () => {
    return timeOfDay === 'morning' ? 'Morning' : 'Afternoon';
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-600">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-dark-50">
              Log {getTimeLabel()} Mood
            </h2>
            <p className="text-sm text-neutral-600 dark:text-dark-400 mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:text-dark-400 dark:hover:text-dark-200 text-2xl leading-none"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Mood Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 dark:text-dark-300 mb-3">
              How are you feeling?
            </label>
            <div className="grid grid-cols-4 gap-3">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedMood === mood.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-dark-600 hover:border-neutral-300 dark:hover:border-dark-500'
                  }`}
                  aria-label={`Select ${mood.label} mood`}
                  aria-pressed={selectedMood === mood.value}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-xs text-neutral-600 dark:text-dark-400">{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes Field */}
          <div>
            <label htmlFor="mood-notes" className="block text-sm font-medium text-neutral-700 dark:text-dark-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              id="mood-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Add any notes about your mood..."
              className="w-full px-3 py-2 border border-neutral-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-dark-50 resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-neutral-500 dark:text-dark-400 mt-1 text-right">
              {notes.length}/500
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-neutral-200 dark:border-dark-600">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-neutral-300 dark:border-dark-600 text-neutral-700 dark:text-dark-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedMood || isLoading}
            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Mood'}
          </button>
        </div>
      </div>
    </div>
  );
}
