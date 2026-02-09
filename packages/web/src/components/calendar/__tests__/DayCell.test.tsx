/**
 * DayCell Component Tests
 *
 * Tests the individual calendar day cell component including:
 * - Split cell design (morning/afternoon)
 * - Mood indicator display for both time periods
 * - Color coding for different moods
 * - Journal emotion indicators
 * - Today highlighting
 * - Current month vs other month styling
 * - Disabled states
 * - Click interactions for each half
 * - Accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayCell } from '../DayCell';
import type { DayData } from '../types';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, format: string) => {
    if (format === 'd') {
      return '15';
    }
    return '2024-01-15';
  },
}));

describe('DayCell', () => {
  const defaultProps = {
    date: new Date('2024-01-15'),
    isCurrentMonth: true,
    isToday: false,
    onClick: vi.fn(),
    isDisabled: false,
  };

  const emptyDayData: DayData = {
    date: new Date('2024-01-15'),
    morningMood: null,
    afternoonMood: null,
    morningNotes: null,
    afternoonNotes: null,
    journalEmotions: [],
    hasJournalEntries: false,
  };

  describe('Rendering', () => {
    it('should render day number', () => {
      render(<DayCell {...defaultProps} />);

      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should render as div (not button) with split design', () => {
      const { container } = render(<DayCell {...defaultProps} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toBeInTheDocument();
    });

    it('should have clickable morning half', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DayCell {...defaultProps} onClick={onClick} data={emptyDayData} />);

      const morningHalf = screen.getByLabelText(/Morning mood/);
      await user.click(morningHalf);

      expect(onClick).toHaveBeenCalledWith('morning');
    });

    it('should have clickable afternoon half', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DayCell {...defaultProps} onClick={onClick} data={emptyDayData} />);

      const afternoonHalf = screen.getByLabelText(/Afternoon mood/);
      await user.click(afternoonHalf);

      expect(onClick).toHaveBeenCalledWith('afternoon');
    });
  });

  describe('Current Month Styling', () => {
    it('should apply normal styling when in current month', () => {
      const { container } = render(<DayCell {...defaultProps} isCurrentMonth={true} data={emptyDayData} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      // Check that the cell has the base class and not the disabled class
      expect(cell).toHaveClass('relative');
      expect(cell).not.toHaveClass('opacity-50');
    });

    it('should apply muted styling when not in current month', () => {
      const { container } = render(<DayCell {...defaultProps} isCurrentMonth={false} data={emptyDayData} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toHaveClass('text-neutral-300');
    });

    it('should not be clickable when not in current month', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DayCell {...defaultProps} isCurrentMonth={false} onClick={onClick} data={emptyDayData} />);

      // The clickable halves should not exist when not in current month
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Today Highlighting', () => {
    it('should show ring when it is today', () => {
      const { container } = render(<DayCell {...defaultProps} isToday={true} data={emptyDayData} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toHaveClass('ring-1');
      expect(cell).toHaveClass('ring-primary-500');
    });

    it('should not show ring when not today', () => {
      const { container } = render(<DayCell {...defaultProps} isToday={false} data={emptyDayData} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).not.toHaveClass('ring-1');
    });

    it('should have aria-current="date" when today', () => {
      const { container } = render(<DayCell {...defaultProps} isToday={true} data={emptyDayData} />);

      // Find the div that has aria-current attribute
      const cell = container.querySelector('[aria-current="date"]');
      expect(cell).toBeInTheDocument();
      expect(cell).toHaveAttribute('aria-current', 'date');
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styling when disabled', () => {
      const { container } = render(<DayCell {...defaultProps} isDisabled={true} data={emptyDayData} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toHaveClass('opacity-50');
    });

    it('should not show clickable halves when disabled', () => {
      render(<DayCell {...defaultProps} isDisabled={true} data={emptyDayData} />);

      // When disabled, the clickable halves should not have role="button"
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('Morning Mood Display', () => {
    it('should show happy morning mood with yellow styling', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const morningHalf = container.querySelector('.flex-1');
      expect(morningHalf).toHaveClass('bg-yellow-200/70');
      expect(morningHalf).toHaveClass('dark:bg-yellow-700/30');
    });

    it('should display morning mood emoji', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.getByText('😊')).toBeInTheDocument();
    });

    it('should not show morning emoji when no morning mood', () => {
      render(<DayCell {...defaultProps} data={emptyDayData} />);

      expect(screen.queryByText('😊')).not.toBeInTheDocument();
    });
  });

  describe('Afternoon Mood Display', () => {
    it('should show sad afternoon mood with blue styling', () => {
      const data: DayData = {
        ...emptyDayData,
        afternoonMood: 'sad',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const halves = container.querySelectorAll('[class*="flex-1"]');
      const afternoonHalf = halves[1]; // Bottom half
      expect(afternoonHalf).toHaveClass('bg-blue-500');
      expect(afternoonHalf).toHaveClass('dark:bg-blue-700/50');
    });

    it('should display afternoon mood emoji', () => {
      const data: DayData = {
        ...emptyDayData,
        afternoonMood: 'sad',
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.getByText('😢')).toBeInTheDocument();
    });

    it('should not show afternoon emoji when no afternoon mood', () => {
      render(<DayCell {...defaultProps} data={emptyDayData} />);

      expect(screen.queryByText('😢')).not.toBeInTheDocument();
    });
  });

  describe('Both Morning and Afternoon Moods', () => {
    it('should display both morning and afternoon moods', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.getByText('😊')).toBeInTheDocument();
      expect(screen.getByText('😢')).toBeInTheDocument();
    });

    it('should show different colors for morning and afternoon', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'angry',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const halves = container.querySelectorAll('[class*="flex-1"]');
      expect(halves[0]).toHaveClass(/bg-yellow/); // Morning happy
      expect(halves[1]).toHaveClass(/bg-red/); // Afternoon angry
    });

    it('should handle clicking morning half when both moods exist', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
      };

      const { container } = render(<DayCell {...defaultProps} onClick={onClick} data={data} />);

      const halves = container.querySelectorAll('[role="button"]');
      await user.click(halves[0]);

      expect(onClick).toHaveBeenCalledWith('morning');
    });

    it('should handle clicking afternoon half when both moods exist', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
      };

      const { container } = render(<DayCell {...defaultProps} onClick={onClick} data={data} />);

      const halves = container.querySelectorAll('[role="button"]');
      await user.click(halves[1]);

      expect(onClick).toHaveBeenCalledWith('afternoon');
    });
  });

  describe('Notes Indicators', () => {
    it('should show morning notes indicator', () => {
      const data: DayData = {
        ...emptyDayData,
        morningNotes: 'Feeling great',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const notesDot = container.querySelector('.bg-amber-500');
      expect(notesDot).toBeInTheDocument();
    });

    it('should show afternoon notes indicator', () => {
      const data: DayData = {
        ...emptyDayData,
        afternoonNotes: 'Tired afternoon',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const notesDots = container.querySelectorAll('.bg-amber-500');
      expect(notesDots.length).toBeGreaterThan(0);
    });

    it('should show both morning and afternoon notes indicators', () => {
      const data: DayData = {
        ...emptyDayData,
        morningNotes: 'Good morning',
        afternoonNotes: 'Good afternoon',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const notesDots = container.querySelectorAll('.bg-amber-500');
      expect(notesDots.length).toBe(2);
    });
  });

  describe('Journal Emotions Display', () => {
    it('should show journal indicator when has journal entries but no moods', () => {
      const data: DayData = {
        ...emptyDayData,
        journalEmotions: ['happy'],
        hasJournalEntries: true,
      };

      render(<DayCell {...defaultProps} data={data} />);

      const emotionDot = document.querySelector('.bg-yellow-500');
      expect(emotionDot).toBeInTheDocument();
    });

    it('should show journal indicator alongside mood indicators', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        journalEmotions: ['sad'],
        hasJournalEntries: true,
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      // Should show journal indicator
      const indicator = container.querySelector('.bg-white');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should include moods in aria-label when both exist', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      // Find the cell div that has aria-label
      const cell = container.querySelector('[aria-label*="Day 15"]');
      expect(cell).toHaveAttribute('aria-label', expect.stringContaining('morning: happy'));
      expect(cell).toHaveAttribute('aria-label', expect.stringContaining('afternoon: sad'));
    });

    it('should have simple aria-label when no moods or journal', () => {
      const { container } = render(<DayCell {...defaultProps} data={emptyDayData} />);

      const cell = container.querySelector('[aria-label*="Day 15"]');
      expect(cell).toHaveAttribute('aria-label', 'Day 15');
    });

    it('should be keyboard navigable for morning', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DayCell {...defaultProps} onClick={onClick} data={emptyDayData} />);

      const morningHalf = screen.getByLabelText(/Morning mood/);
      morningHalf.focus();
      expect(morningHalf).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledWith('morning');
    });

    it('should be keyboard navigable for afternoon', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<DayCell {...defaultProps} onClick={onClick} data={emptyDayData} />);

      const afternoonHalf = screen.getByLabelText(/Afternoon mood/);
      afternoonHalf.focus();
      expect(afternoonHalf).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledWith('afternoon');
    });
  });

  describe('Hover States', () => {
    it('should have hover effect for halves without mood', async () => {
      const user = userEvent.setup();
      const { container } = render(<DayCell {...defaultProps} data={emptyDayData} />);

      const halves = container.querySelectorAll('[class*="cursor-pointer"]');
      const morningHalf = halves[0];

      await user.hover(morningHalf as Element);
      expect(morningHalf).toHaveClass('hover:bg-neutral-50');
    });

    it('should maintain mood color on hover when mood exists', async () => {
      const user = userEvent.setup();
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const halves = container.querySelectorAll('[class*="cursor-pointer"]');
      const morningHalf = halves[0];

      await user.hover(morningHalf as Element);

      // Mood color should persist
      expect(morningHalf).toHaveClass(/bg-yellow/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null data', () => {
      const { container } = render(<DayCell {...defaultProps} data={undefined} />);

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toBeInTheDocument();
    });

    it('should handle very long date boundaries', () => {
      const futureDate = new Date('2099-12-31');

      render(
        <DayCell
          {...defaultProps}
          date={futureDate}
          data={emptyDayData}
        />
      );

      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should handle day with only morning mood', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: null,
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.getByText('😊')).toBeInTheDocument();
      expect(screen.queryByText('😢')).not.toBeInTheDocument();
    });

    it('should handle day with only afternoon mood', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: null,
        afternoonMood: 'sad',
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.queryByText('😊')).not.toBeInTheDocument();
      expect(screen.getByText('😢')).toBeInTheDocument();
    });
  });

  describe('Divider', () => {
    it('should show divider between morning and afternoon', () => {
      const { container } = render(<DayCell {...defaultProps} data={emptyDayData} />);

      const divider = container.querySelector('.h-px');
      expect(divider).toBeInTheDocument();
    });

    it('should have neutral border color for divider', () => {
      const { container } = render(<DayCell {...defaultProps} data={emptyDayData} />);

      const divider = container.querySelector('.h-px');
      expect(divider).toHaveClass('bg-neutral-200');
    });
  });

  describe('Today Ring with Moods', () => {
    it('should show today ring with morning mood', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
      };

      const { container } = render(
        <DayCell
          {...defaultProps}
          data={data}
          isToday={true}
        />
      );

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toHaveClass('ring-1');
    });

    it('should show today ring with both moods', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
      };

      const { container } = render(
        <DayCell
          {...defaultProps}
          data={data}
          isToday={true}
        />
      );

      const cell = container.querySelector('div[class*="aspect-square"]');
      expect(cell).toHaveClass('ring-1');
    });
  });

  describe('Combinations', () => {
    it('should show morning mood, afternoon mood, and journal indicator', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
        journalEmotions: ['neutral'],
        hasJournalEntries: true,
      };

      render(<DayCell {...defaultProps} data={data} />);

      expect(screen.getByText('😊')).toBeInTheDocument();
      expect(screen.getByText('😢')).toBeInTheDocument();

      const { container } = render(<DayCell {...defaultProps} data={data} />);
      const indicator = container.querySelector('.bg-white');
      expect(indicator).toBeInTheDocument();
    });

    it('should show notes indicators for both time periods with moods', () => {
      const data: DayData = {
        ...emptyDayData,
        morningMood: 'happy',
        afternoonMood: 'sad',
        morningNotes: 'Great morning',
        afternoonNotes: 'Tired afternoon',
      };

      const { container } = render(<DayCell {...defaultProps} data={data} />);

      const notesDots = container.querySelectorAll('.bg-amber-500');
      expect(notesDots.length).toBe(2);
    });
  });
});
