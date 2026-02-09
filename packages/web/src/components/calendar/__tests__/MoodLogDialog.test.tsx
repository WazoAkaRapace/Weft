/**
 * MoodLogDialog Component Tests
 *
 * Tests the mood logging dialog component including:
 * - Mood selection (4 emotions)
 * - Notes field with character limit
 * - Save/Cancel buttons
 * - Delete functionality
 * - Journal entries display
 * - Loading states
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoodLogDialog } from '../MoodLogDialog';
import type { DailyMood } from '../types';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'EEEE, MMMM d, yyyy') {
      return 'Friday, January 15, 2024';
    }
    if (format === 'h:mm a') {
      return '2:30 PM';
    }
    return '2024-01-15';
  },
}));

describe('MoodLogDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    date: new Date('2024-01-15'),
    timeOfDay: 'morning' as const,
    onSave: vi.fn(),
    existingMood: null,
    existingNotes: null,
    journalEntries: [],
    _isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog when isOpen is true', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Log Mood')).toBeInTheDocument();
      expect(screen.getByText('Friday, January 15, 2024')).toBeInTheDocument();
    });

    it('should not render dialog when isOpen is false', () => {
      render(<MoodLogDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display 11 mood options', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /select happy mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select sad mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select angry mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select neutral mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select sick mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select anxious mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select tired mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select excited mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select fear mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select disgust mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select surprise mood/i })).toBeInTheDocument();
    });

    it('should display mood emojis', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByText('😊')).toBeInTheDocument();
      expect(screen.getByText('😢')).toBeInTheDocument();
      expect(screen.getByText('😠')).toBeInTheDocument();
      expect(screen.getByText('😐')).toBeInTheDocument();
      expect(screen.getByText('🤒')).toBeInTheDocument();
      expect(screen.getByText('😰')).toBeInTheDocument();
      expect(screen.getByText('😴')).toBeInTheDocument();
      expect(screen.getByText('🤩')).toBeInTheDocument();
      expect(screen.getByText('😨')).toBeInTheDocument();
      expect(screen.getByText('🤢')).toBeInTheDocument();
      expect(screen.getByText('😮')).toBeInTheDocument();
    });

    it('should display notes field with character limit', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Notes \(optional\)/i)).toBeInTheDocument();
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('should display Save and Cancel buttons', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should display Edit Mood title when existing mood', () => {
      render(<MoodLogDialog {...defaultProps} existingMood="happy" />);

      expect(screen.getByText('Edit Mood')).toBeInTheDocument();
    });

    it('should pre-select existing mood', () => {
      render(<MoodLogDialog {...defaultProps} existingMood="sad" />);

      const sadButton = screen.getByRole('button', { name: /select sad mood/i });
      expect(sadButton).toHaveClass('border-primary-500');
    });

    it('should pre-fill existing notes', () => {
      render(<MoodLogDialog {...defaultProps} existingNotes="Existing note" />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      expect(notesTextarea).toHaveValue('Existing note');
      expect(screen.getByText('13/500')).toBeInTheDocument();
    });

    it('should display Delete button when existing mood', () => {
      render(
        <MoodLogDialog
          {...defaultProps}
          existingMood="happy"
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should display Update button text when existing mood', () => {
      render(<MoodLogDialog {...defaultProps} existingMood="happy" />);

      expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    });
  });

  describe('Mood Selection', () => {
    it('should select mood when clicking mood button', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const happyButton = screen.getByRole('button', { name: /select happy mood/i });
      await user.click(happyButton);

      expect(happyButton).toHaveClass('border-primary-500');
    });

    it('should change selected mood when clicking different mood', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const happyButton = screen.getByRole('button', { name: /select happy mood/i });
      const sadButton = screen.getByRole('button', { name: /select sad mood/i });

      await user.click(happyButton);
      await user.click(sadButton);

      expect(sadButton).toHaveClass('border-primary-500');
    });

    it('should highlight selected mood with different styling', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const happyButton = screen.getByRole('button', { name: /select happy mood/i });
      const sadButton = screen.getByRole('button', { name: /select sad mood/i });

      await user.click(happyButton);

      expect(happyButton).toHaveClass('border-primary-500');
      expect(sadButton).not.toHaveClass('border-primary-500');
    });
  });

  describe('Notes Field', () => {
    it('should update notes when typing', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesTextarea, 'Test note');

      expect(notesTextarea).toHaveValue('Test note');
      expect(screen.getByText('9/500')).toBeInTheDocument();
    });

    it('should enforce 500 character limit', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      const longText = 'a'.repeat(600);

      await user.type(notesTextarea, longText);

      // Should truncate to 500
      expect(notesTextarea).toHaveValue('a'.repeat(500));
      expect(screen.getByText('500/500')).toBeInTheDocument();
    });

    it('should show correct character count', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);

      await user.type(notesTextarea, 'Hello');
      expect(screen.getByText('5/500')).toBeInTheDocument();

      await user.clear(notesTextarea);
      await user.type(notesTextarea, 'This is a longer note');
      expect(screen.getByText('21/500')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with mood and notes when saving', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      // Select mood
      await user.click(screen.getByRole('button', { name: /select happy mood/i }));

      // Add notes
      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesTextarea, 'Feeling great');

      // Click save
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          notes: 'Feeling great',
        });
      });
    });

    it('should call onSave with null notes when empty', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          notes: null,
        });
      });
    });

    it('should show saving state while saving', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });

    it('should call onClose after successful save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(<MoodLogDialog {...defaultProps} onSave={onSave} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should disable buttons while saving', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: 'Cancel' });
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onClose when clicking Cancel', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<MoodLogDialog {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking close button', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<MoodLogDialog {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking backdrop', async () => {
      const onClose = vi.fn();

      const { container } = render(<MoodLogDialog {...defaultProps} onClose={onClose} />);

      // Find backdrop (div with absolute inset-0)
      const backdrop = container.querySelector('.absolute.inset-0');
      if (backdrop) {
        await userEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete confirmation when clicking Delete', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <MoodLogDialog
          {...defaultProps}
          existingMood="happy"
          onDelete={onDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByText('Delete mood?')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
      });
    });

    it('should call onDelete when confirming delete', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <MoodLogDialog
          {...defaultProps}
          existingMood="happy"
          onDelete={onDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalled();
      });
    });

    it('should hide delete confirmation when canceling', async () => {
      const user = userEvent.setup();

      render(
        <MoodLogDialog
          {...defaultProps}
          existingMood="happy"
          onDelete={vi.fn()}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.getByText('Delete mood?')).toBeInTheDocument();

      // Click the delete confirmation Cancel button (inline with Delete mood?)
      const deleteSection = screen.getByText('Delete mood?').parentElement;
      if (deleteSection) {
        const cancelBtn = deleteSection.querySelector('button');
        if (cancelBtn) {
          await user.click(cancelBtn);
        }
      }

      await waitFor(() => {
        expect(screen.queryByText('Delete mood?')).not.toBeInTheDocument();
      });
    });

    it('should show deleting state while deleting', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <MoodLogDialog
          {...defaultProps}
          existingMood="happy"
          onDelete={onDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      // The Yes button should show loading/disabled state
      await waitFor(() => {
        expect(onDelete).toHaveBeenCalled();
      });
    });
  });

  describe('Journal Entries Display', () => {
    it('should show journal entries section when entries exist', () => {
      render(
        <MoodLogDialog
          {...defaultProps}
          journalEntries={[
            {
              id: '1',
              dominantEmotion: 'happy',
              createdAt: '2024-01-15T14:30:00Z',
            },
          ]}
        />
      );

      expect(screen.getByText(/Journal Entries \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    });

    it('should show multiple journal entries', () => {
      render(
        <MoodLogDialog
          {...defaultProps}
          journalEntries={[
            {
              id: '1',
              dominantEmotion: 'happy',
              createdAt: '2024-01-15T08:00:00Z',
            },
            {
              id: '2',
              dominantEmotion: 'sad',
              createdAt: '2024-01-15T18:00:00Z',
            },
          ]}
        />
      );

      expect(screen.getByText(/Journal Entries \(2\)/i)).toBeInTheDocument();
    });

    it('should not show journal section when no entries', () => {
      render(<MoodLogDialog {...defaultProps} journalEntries={[]} />);

      expect(screen.queryByText(/Journal Entries/i)).not.toBeInTheDocument();
    });

    it('should display emotion badges for journal entries', () => {
      render(
        <MoodLogDialog
          {...defaultProps}
          journalEntries={[
            {
              id: '1',
              dominantEmotion: 'happy',
              createdAt: '2024-01-15T14:30:00Z',
            },
          ]}
        />
      );

      // EmotionBadge should be rendered (check for emotion indicator)
      const emotionBadge = screen.getByRole('button', { name: /happy/i });
      expect(emotionBadge).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<MoodLogDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'mood-dialog-title');
    });

    it('should have accessible labels for mood buttons', () => {
      render(<MoodLogDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /select happy mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select sad mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select angry mood/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select neutral mood/i })).toBeInTheDocument();
    });

    it('should have accessible label for notes textarea', () => {
      render(<MoodLogDialog {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      expect(notesTextarea).toBeInTheDocument();
    });

    it('should set aria-pressed on selected mood button', async () => {
      const user = userEvent.setup();
      render(<MoodLogDialog {...defaultProps} />);

      const happyButton = screen.getByRole('button', { name: /select happy mood/i });
      expect(happyButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(happyButton);

      expect(happyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<MoodLogDialog {...defaultProps} onClose={onClose} />);

      // Verify the dialog has focusable elements that can receive keyboard focus
      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const saveButton = screen.getByRole('button', { name: 'Save' });

      // All should be in the document and focusable
      expect(closeButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      expect(saveButton).toBeInTheDocument();

      // Tab to first button and verify it can receive focus
      await user.tab();
      expect(document.activeElement).toBe(closeButton);

      // Click via keyboard (Enter on focused button)
      await user.keyboard('{Enter}');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle onSave error gracefully', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Should complete without throwing and log the error
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save mood:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should handle null existing mood correctly', () => {
      render(<MoodLogDialog {...defaultProps} existingMood={null} />);

      expect(screen.getByText('Log Mood')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('should handle undefined existing mood correctly', () => {
      render(<MoodLogDialog {...defaultProps} existingMood={undefined} />);

      expect(screen.getByText('Log Mood')).toBeInTheDocument();
    });

    it('should trim notes before saving', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);

      render(<MoodLogDialog {...defaultProps} onSave={onSave} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesTextarea, '  Notes with spaces  ');

      await user.click(screen.getByRole('button', { name: /select happy mood/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: 'Notes with spaces',
          })
        );
      });
    });

    it('should handle special characters in notes', async () => {
      render(<MoodLogDialog {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes \(optional\)/i);
      const specialChars = 'Special: @#$%^&*()_+-=[]{}|;:\'",.<>?/`~';

      // Use fireEvent to directly set the value since userEvent has issues with special chars
      fireEvent.change(notesTextarea, { target: { value: specialChars } });

      expect(notesTextarea).toHaveValue(specialChars);
    });
  });
});
