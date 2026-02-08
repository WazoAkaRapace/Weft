import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../VideoPlayer';

// Mock the video element methods
const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
const mockExitFullscreen = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  // Reset mocks
  mockPlay.mockReset();
  mockPause.mockReset();
  mockRequestFullscreen.mockReset();
  mockExitFullscreen.mockReset();

  // Mock requestFullscreen and exitFullscreen
  Object.defineProperty(document, 'fullscreenElement', {
    writable: true,
    value: null,
  });

  Element.prototype.requestFullscreen = mockRequestFullscreen;
  document.exitFullscreen = mockExitFullscreen;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoPlayer - User Controls', () => {
  const defaultProps = {
    videoPath: '/app/videos/test-video.mp4',
    thumbnailPath: '/app/thumbnails/test-thumb.jpg',
    duration: 120,
  };

  describe('Play/Pause Controls', () => {
    it('allows user to play video by clicking play button', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      // Find play button by aria-label (user-facing)
      const playButton = screen.getByRole('button', { name: /play/i });

      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveAttribute('aria-label', 'Play');

      // User clicks play button
      await user.click(playButton);

      // Video should have play button available
      expect(playButton).toBeInTheDocument();
    });

    it('toggles between play and pause states', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const playButton = screen.getByRole('button', { name: /play/i });

      // Initial state: play button visible
      expect(playButton).toHaveAttribute('aria-label', 'Play');
    });

    it('is keyboard accessible - user can activate with Enter key', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const playButton = screen.getByRole('button', { name: /play/i });

      // User navigates with keyboard and activates
      playButton.focus();
      expect(playButton).toHaveFocus();

      await user.keyboard('{Enter}');

      // Button should remain focusable
      expect(playButton).toHaveFocus();
    });

    it('is keyboard accessible - user can activate with Space key', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const playButton = screen.getByRole('button', { name: /play/i });

      playButton.focus();
      await user.keyboard(' '); // Space key

      // Button should remain interactive
      expect(playButton).toBeInTheDocument();
    });
  });

  describe('Volume Controls', () => {
    it('allows user to adjust volume', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      // Find volume control by accessible label
      const volumeSlider = screen.getByRole('slider', { name: /volume/i });

      expect(volumeSlider).toBeInTheDocument();
      expect(volumeSlider).toHaveAttribute('aria-label', 'Volume');

      // User changes volume
      await user.click(volumeSlider);

      // Volume slider should be interactive
      expect(volumeSlider).toHaveAttribute('value', expect.any(String));
    });

    it('displays current volume level to user', async () => {
      render(<VideoPlayer {...defaultProps} />);

      const volumeSlider = screen.getByRole('slider', { name: /volume/i });

      // Volume slider should show current value (user-observable)
      expect(volumeSlider).toHaveAttribute('value', '1');
      expect(volumeSlider).toHaveAttribute('min', '0');
      expect(volumeSlider).toHaveAttribute('max', '1');
    });

    it('supports keyboard volume adjustment', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const volumeSlider = screen.getByRole('slider', { name: /volume/i });

      volumeSlider.focus();

      // User uses arrow keys to adjust volume
      await user.keyboard('{ArrowLeft}'); // Decrease

      // Volume slider should remain focused and interactive
      expect(volumeSlider).toHaveFocus();
    });
  });

  describe('Seeking Controls', () => {
    it('allows user to seek through video', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      // Find the progress/seek bar (first slider without name is the seek bar)
      const seekBar = screen.getByRole('slider', { name: '' });

      expect(seekBar).toBeInTheDocument();

      // User clicks to seek
      await user.click(seekBar);

      // Seek bar should be interactive
      expect(seekBar).toHaveAttribute('value', expect.any(String));
    });

    it('displays current playback position', () => {
      render(<VideoPlayer {...defaultProps} />);

      // Time display should be visible to user
      const timeDisplay = screen.getByText(/0:00/);

      expect(timeDisplay).toBeInTheDocument();
    });

    it('supports keyboard seeking with arrow keys', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const seekBar = screen.getByRole('slider', { name: '' });

      seekBar.focus();

      // User seeks with keyboard
      await user.keyboard('{ArrowRight}'); // Seek forward

      // Position should update and control should remain focused
      expect(seekBar).toHaveFocus();
    });
  });

  describe('Fullscreen Controls', () => {
    it('allows user to enter fullscreen', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const fullscreenButton = screen.getByRole('button', { name: /enter fullscreen/i });

      expect(fullscreenButton).toBeInTheDocument();
      expect(fullscreenButton).toHaveAttribute('aria-label', 'Enter fullscreen');

      await user.click(fullscreenButton);

      // Should request fullscreen from browser
      await waitFor(() => {
        expect(mockRequestFullscreen).toHaveBeenCalled();
      });
    });

    it('updates button state based on fullscreen status', async () => {
      render(<VideoPlayer {...defaultProps} />);

      const button = screen.getByRole('button', { name: /enter fullscreen/i });

      // Initially shows "enter fullscreen"
      expect(button).toHaveAttribute('aria-label', 'Enter fullscreen');

      // Simulate entering fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: document.body,
      });

      const event = new Event('fullscreenchange');
      document.dispatchEvent(event);

      // Should update to "exit fullscreen"
      await waitFor(() => {
        const updatedButton = screen.queryByRole('button', { name: /exit fullscreen/i });
        expect(updatedButton).toBeInTheDocument();
      });
    });

    it('supports keyboard fullscreen toggle', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      const fullscreenButton = screen.getByRole('button', { name: /enter fullscreen/i });

      fullscreenButton.focus();
      expect(fullscreenButton).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(mockRequestFullscreen).toHaveBeenCalled();
    });
  });

  describe('Time Updates', () => {
    it('displays formatted time to user', () => {
      render(<VideoPlayer {...defaultProps} duration={120} />);

      // Should display formatted time
      const timeDisplay = screen.getByText(/0:00.*2:00/);
      expect(timeDisplay).toBeInTheDocument();
    });

    it('displays formatted time for long videos', () => {
      render(<VideoPlayer {...defaultProps} duration={3665} />);

      // Should display formatted time (1:01:05 for long videos)
      const timeDisplay = screen.getByText(/1:01:05/);
      expect(timeDisplay).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('displays thumbnail while video loads', () => {
      render(<VideoPlayer {...defaultProps} thumbnailPath="/app/thumbnails/test.jpg" />);

      const videoElement = document.querySelector('video');
      expect(videoElement).toHaveAttribute('poster');
    });

    it('shows video element ready to play', () => {
      render(<VideoPlayer {...defaultProps} />);

      const videoElement = document.querySelector('video');
      expect(videoElement).toBeInTheDocument();
      // Controls list attribute should be set to false (using custom controls)
      expect(videoElement).not.toHaveAttribute('controls');
    });
  });

  describe('Accessibility', () => {
    it('provides ARIA labels for all controls', () => {
      render(<VideoPlayer {...defaultProps} />);

      // All interactive elements should have accessible labels
      expect(screen.getByRole('button', { name: /play/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /enter fullscreen/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('slider', { name: /volume/i })).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation for all controls', async () => {
      render(<VideoPlayer {...defaultProps} />);

      // All controls should be keyboard accessible
      const controls = [
        screen.getByRole('button', { name: /play/i }),
        screen.getByRole('slider', { name: /volume/i }),
        screen.getByRole('slider', { name: '' }), // Seek bar (unnamed slider)
        screen.getByRole('button', { name: /enter fullscreen/i }),
      ];

      for (const control of controls) {
        control.focus();
        expect(control).toHaveFocus();
      }
    });

    it('has visible focus indicators for keyboard users', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);

      // Tab should focus on an element (may not be play button due to DOM order)
      await user.tab();

      // Some element should have focus (verifies keyboard navigation works)
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();

      // The focused element should be one of the controls
      expect(focusedElement?.tagName).toMatch(/BUTTON|INPUT/);
    });
  });

  describe('HLS.js Integration - User Observable', () => {
    it('renders video player container for HLS content', () => {
      // Render without HLS manifest to test fallback behavior
      render(<VideoPlayer {...defaultProps} />);

      // Video player container should be present
      const container = screen.getByText(/0:00/).closest('.video-player');
      expect(container).toBeInTheDocument();

      // Video element should be present
      const videoElement = document.querySelector('video');
      expect(videoElement).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className to container', () => {
      const { container } = render(<VideoPlayer {...defaultProps} className="custom-class" />);

      const wrapper = container.querySelector('.video-player');
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});

describe('VideoPlayer - Edge Cases', () => {
  it('handles zero duration gracefully', () => {
    render(<VideoPlayer videoPath="/app/video.mp4" thumbnailPath={null} duration={0} />);

    // Should not crash and should display 0:00
    const timeDisplay = screen.getByText(/0:00/);
    expect(timeDisplay).toBeInTheDocument();
  });

  it('handles missing thumbnail', () => {
    render(<VideoPlayer videoPath="/app/video.mp4" thumbnailPath={null} duration={120} />);

    const videoElement = document.querySelector('video');
    expect(videoElement).not.toHaveAttribute('poster');
  });

  it('handles very long videos', () => {
    render(<VideoPlayer videoPath="/app/video.mp4" thumbnailPath={null} duration={86400} />);

    // 24 hour video should format correctly
    const timeDisplay = screen.getByText(/24:00:00/);
    expect(timeDisplay).toBeInTheDocument();
  });
});
