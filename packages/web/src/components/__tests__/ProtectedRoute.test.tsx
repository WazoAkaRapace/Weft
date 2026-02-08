import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

describe('ProtectedRoute - Routing Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter initialEntries={['/protected']}>
        <ThemeProvider>
          <NavigationProvider>
            <NotesProvider>{ui}</NotesProvider>
          </NavigationProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  describe('Authentication Protection', () => {
    it('redirects unauthenticated users to login page', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: false,
      });

      const { ProtectedRoute } = await import('../ProtectedRoute');

      renderWithRouter(
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getByText(/login page/i)).toBeInTheDocument();
      });
    });

    it('allows authenticated users to access protected content', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: { user: { id: '1', email: 'test@example.com' } },
        isPending: false,
      });

      const { ProtectedRoute } = await import('../ProtectedRoute');

      renderWithRouter(
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getByText(/protected content/i)).toBeInTheDocument();
      });
    });

    it('shows loading state while checking authentication', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: true,
      });

      const { ProtectedRoute } = await import('../ProtectedRoute');

      renderWithRouter(
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('provides clear loading feedback to users', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: true,
      });

      const { ProtectedRoute } = await import('../ProtectedRoute');

      renderWithRouter(
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      );

      const loadingText = screen.getByText(/loading/i);
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toBeVisible();
    });

    it('prevents access to sensitive content without authentication', async () => {
      const { useSession } = await import('../../lib/auth');
      vi.mocked(useSession).mockReturnValue({
        data: null,
        isPending: false,
      });

      const { ProtectedRoute } = await import('../ProtectedRoute');

      renderWithRouter(
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Secret Data</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      );

      await waitFor(() => {
        expect(screen.queryByText(/secret data/i)).not.toBeInTheDocument();
        expect(screen.getByText(/login page/i)).toBeInTheDocument();
      });
    });
  });
});
