import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { NotesProvider } from '../../contexts/NotesContext';

// Mock the auth client
vi.mock('../../lib/auth', () => ({
  useSession: vi.fn(),
}));

// Mock the useNotes hook to avoid errors
vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [],
    noteTree: [],
    loading: false,
    error: null,
    fetchNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

describe('OnboardingGuard - Routing Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <ThemeProvider>
          <NavigationProvider>
            <NotesProvider>{ui}</NotesProvider>
          </NavigationProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  describe('Onboarding Flow', () => {
    it('shows children when users exist', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: false,
      });

      // Mock fetch to return users exist
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ hasUsers: true }),
        })
      ) as any;

      const { OnboardingGuard } = await import('../OnboardingGuard');

      renderWithRouter(
        <OnboardingGuard>
          <div>Login Page Content</div>
        </OnboardingGuard>
      );

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(screen.getByText(/login page content/i)).toBeInTheDocument();
      });
    });

    it('bypasses onboarding check for authenticated users', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: { user: { id: '1', email: 'test@example.com' } },
        isPending: false,
      });

      const { OnboardingGuard } = await import('../OnboardingGuard');

      renderWithRouter(
        <OnboardingGuard>
          <div>Login Page Content</div>
        </OnboardingGuard>
      );

      // Should show children for authenticated users
      expect(screen.getByText(/login page content/i)).toBeInTheDocument();
      // Should not call fetch since user is authenticated
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state while checking session', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: true,
      });

      const { OnboardingGuard } = await import('../OnboardingGuard');

      renderWithRouter(
        <OnboardingGuard>
          <div>Login Page Content</div>
        </OnboardingGuard>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('provides clear loading feedback', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: true,
      });

      const { OnboardingGuard } = await import('../OnboardingGuard');

      renderWithRouter(
        <OnboardingGuard>
          <div>Login Page Content</div>
        </OnboardingGuard>
      );

      const loadingText = screen.getByText(/loading/i);
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: false,
      });

      // Mock fetch to fail
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

      const { OnboardingGuard } = await import('../OnboardingGuard');

      renderWithRouter(
        <OnboardingGuard>
          <div>Login Page Content</div>
        </OnboardingGuard>
      );

      // Should show children on error (safe default)
      await waitFor(() => {
        expect(screen.getByText(/login page content/i)).toBeInTheDocument();
      });
    });
  });
});
