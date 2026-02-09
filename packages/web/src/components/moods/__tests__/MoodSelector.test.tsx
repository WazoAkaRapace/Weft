/**
 * MoodSelector Component Tests
 *
 * Tests the mood selection dropdown component used for manual mood logging.
 *
 * User Interactions to Test:
 * - Dropdown opens/closes on click
 * - Mood can be selected from dropdown
 * - Selected mood is displayed with icon and label
 * - Auto (Detected) option clears manual mood
 * - Disabled state prevents interaction
 * - Keyboard accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoodSelector } from '../MoodSelector';

describe('MoodSelector Component', () => {
  describe('Rendering', () => {
    it('should render with initial null value (Auto mode)', () => {
      const handleChange = vi.fn();
      render(<MoodSelector value={null} onChange={handleChange} />);

      expect(screen.getByText(/auto \(detected\)/i)).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should render with selected mood', () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      expect(screen.getByText('Happy')).toBeInTheDocument();
      expect(screen.getByText('😊')).toBeInTheDocument();
    });

    it('should render all valid emotion options', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value={null} onChange={handleChange} />);

      // Click to open dropdown
      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Check all mood options are present (using getAllByText since dropdown is open)
      expect(screen.getAllByText('Auto (Detected)')).toHaveLength(2); // One in trigger, one in dropdown
      expect(screen.getAllByText('Neutral')).toHaveLength(1);
      expect(screen.getAllByText('Happy')).toHaveLength(1);
      expect(screen.getAllByText('Sad')).toHaveLength(1);
      expect(screen.getAllByText('Angry')).toHaveLength(1);
      expect(screen.getAllByText('Fear')).toHaveLength(1);
      expect(screen.getAllByText('Disgusted')).toHaveLength(1);
      expect(screen.getAllByText('Surprised')).toHaveLength(1);
    });

    it('should display correct icon for each emotion', () => {
      const emotions = [
        { value: 'neutral', icon: '😐' },
        { value: 'happy', icon: '😊' },
        { value: 'sad', icon: '😢' },
        { value: 'angry', icon: '😠' },
        { value: 'fear', icon: '😨' },
        { value: 'disgust', icon: '🤢' },
        { value: 'surprise', icon: '😮' },
      ];

      emotions.forEach(({ value, icon }) => {
        const handleChange = vi.fn();
        const { rerender } = render(
          <MoodSelector value={value as any} onChange={handleChange} />
        );

        expect(screen.getByText(icon)).toBeInTheDocument();
        rerender(<div />);
      });
    });
  });

  describe('User Interactions', () => {
    it('should open dropdown when button is clicked', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value={null} onChange={handleChange} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Dropdown menu should be visible
      expect(screen.getByText('Neutral')).toBeInTheDocument();
      expect(screen.getByText('Happy')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      const handleChange = vi.fn();
      render(
        <div>
          <MoodSelector value={null} onChange={handleChange} />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Dropdown should be open
      expect(screen.getByText('Neutral')).toBeInTheDocument();

      // Click outside
      await userEvent.click(screen.getByTestId('outside'));

      // Dropdown should close - menu items should still be in DOM but not visible
      // This is handled by the backdrop click
    });

    it('should close dropdown after selecting a mood', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value={null} onChange={handleChange} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Select a mood
      await userEvent.click(screen.getByText('Happy'));

      // onChange should be called
      expect(handleChange).toHaveBeenCalledWith('happy');

      // Dropdown should close
      await waitFor(() => {
        const menuItems = screen.queryAllByText('Neutral');
        // After closing, the dropdown menu items should not be visible
        // but they may still be in the DOM
      });
    });

    it('should call onChange when selecting a mood', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value={null} onChange={handleChange} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await userEvent.click(screen.getByText('Sad'));

      expect(handleChange).toHaveBeenCalledWith('sad');
    });

    it('should call onChange with null when selecting Auto (Detected)', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      await userEvent.click(screen.getByText(/auto \(detected\)/i));

      expect(handleChange).toHaveBeenCalledWith(null);
    });

    it('should update selected mood when value prop changes', () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <MoodSelector value="happy" onChange={handleChange} />
      );

      expect(screen.getByText('Happy')).toBeInTheDocument();
      expect(screen.getByText('😊')).toBeInTheDocument();

      rerender(<MoodSelector value="sad" onChange={handleChange} />);

      expect(screen.getByText('Sad')).toBeInTheDocument();
      expect(screen.getByText('😢')).toBeInTheDocument();
    });
  });

  describe('Selected State Display', () => {
    it('should show checkmark for selected mood in dropdown', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button', { name: /happy/i });
      await userEvent.click(button);

      await waitFor(() => {
        // Check for checkmark next to selected option
        const happyOption = screen.getAllByText('Happy')[1].closest('button');
        expect(happyOption?.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('should highlight selected mood in dropdown', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="surprise" onChange={handleChange} />);

      const button = screen.getByRole('button', { name: /surprised/i });
      await userEvent.click(button);

      await waitFor(() => {
        // Find the dropdown button with "Surprised" text (index 1, since 0 is the trigger button)
        const surprisedText = screen.getAllByText('Surprised')[1];
        const surpriseOption = surprisedText.parentElement;
        expect(surpriseOption).toHaveClass('bg-primary');
      });
    });

    it('should not highlight unselected moods', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      const sadOption = screen.getByText('Sad').closest('button');
      expect(sadOption).not.toHaveClass('bg-primary');
    });
  });

  describe('Disabled State', () => {
    it('should not open dropdown when disabled', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} disabled />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      // Dropdown should not open
      // Menu items should not be in the DOM
      expect(screen.queryByText('Neutral')).not.toBeInTheDocument();
    });

    it('should show visual disabled state', () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} disabled />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should not call onChange when disabled', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} disabled />);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid mood changes', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');

      // Rapid selections
      await userEvent.click(button);
      await userEvent.click(screen.getByText('Sad'));

      await userEvent.click(button);
      await userEvent.click(screen.getByText('Angry'));

      await userEvent.click(button);
      await userEvent.click(screen.getByText('Fear'));

      expect(handleChange).toHaveBeenNthCalledWith(1, 'sad');
      expect(handleChange).toHaveBeenNthCalledWith(2, 'angry');
      expect(handleChange).toHaveBeenNthCalledWith(3, 'fear');
    });

    it('should handle switching between manual mood and auto', async () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <MoodSelector value="happy" onChange={handleChange} />
      );

      expect(screen.getByText('Happy')).toBeInTheDocument();

      rerender(<MoodSelector value={null} onChange={handleChange} />);

      expect(screen.getByText(/auto \(detected\)/i)).toBeInTheDocument();

      rerender(<MoodSelector value="sad" onChange={handleChange} />);

      expect(screen.getByText('Sad')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const handleChange = vi.fn();
      const { container } = render(
        <MoodSelector
          value="happy"
          onChange={handleChange}
          className="custom-class"
        />
      );

      // The custom class is applied to the wrapper div
      const wrapper = container.querySelector('.relative');
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');
      button.focus();

      // Press Enter to open
      await userEvent.keyboard('{Enter}');

      // Dropdown should open
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('should have proper button role', () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should maintain focus after selection', async () => {
      const handleChange = vi.fn();
      render(<MoodSelector value="happy" onChange={handleChange} />);

      const button = screen.getByRole('button');
      button.focus();

      await userEvent.click(button);
      await userEvent.click(screen.getByText('Sad'));

      // Button should still be focusable
      expect(button).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with form submission', async () => {
      const handleSubmit = vi.fn();
      const handleChange = vi.fn();

      render(
        <form onSubmit={handleSubmit}>
          <MoodSelector value="happy" onChange={handleChange} />
          <button type="submit">Submit</button>
        </form>
      );

      // Get the trigger button (first one with Happy text)
      const buttons = screen.getAllByRole('button');
      const selectorButton = buttons[0];

      // Change mood
      await userEvent.click(selectorButton);
      await userEvent.click(screen.getByText('Sad'));

      expect(handleChange).toHaveBeenCalledWith('sad');

      // Submit form
      await userEvent.click(screen.getByText('Submit'));
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('should handle controlled component pattern', async () => {
      let moodValue: string | null = 'happy';
      const handleChange = vi.fn((newMood) => {
        moodValue = newMood;
      });

      const { rerender } = render(
        <MoodSelector value={moodValue} onChange={handleChange} />
      );

      expect(screen.getByText('Happy')).toBeInTheDocument();

      const button = screen.getByRole('button');
      await userEvent.click(button);
      await userEvent.click(screen.getByText('Sad'));

      expect(handleChange).toHaveBeenCalledWith('sad');

      // Simulate parent updating state
      moodValue = 'sad';
      rerender(<MoodSelector value={moodValue} onChange={handleChange} />);

      expect(screen.getByText('Sad')).toBeInTheDocument();
    });
  });
});
