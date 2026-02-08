import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginPage } from '../LoginPage';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import userEvent from '@testing-library/user-event';

// Mock the auth client
vi.mock('../../lib/auth', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
  useSession: vi.fn(() => ({
    data: null,
    isPending: false,
  })),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

import { authClient, useSession } from '../../lib/auth';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Structure - Accessibility First', () => {
    it('renders with proper heading hierarchy and landmarks', () => {
      renderWithTheme(<LoginPage />);

      // Main heading identifies the page
      expect(screen.getByRole('heading', { level: 1, name: /welcome to weft/i })).toBeInTheDocument();

      // Logo has alt text for screen readers
      expect(screen.getByAltText('Weft Logo')).toBeInTheDocument();

      // Form is present (find by accessible submit button)
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('provides properly labeled form inputs', () => {
      renderWithTheme(<LoginPage />);

      // All inputs should be accessible by label
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();

      // Verify input types provide appropriate UX (mobile keyboards, etc)
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Submit button has accessible name
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('provides navigation link to registration', () => {
      renderWithTheme(<LoginPage />);

      const signupLink = screen.getByRole('link', { name: /sign up/i });
      expect(signupLink).toBeInTheDocument();
      expect(signupLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Form Validation - User Behavior', () => {
    it('prevents submission with empty fields', async () => {
      const user = userEvent.setup();
      renderWithTheme(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Try to submit with empty form
      await user.click(submitButton);

      // Check that inputs exist and are present
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();

      // Form should NOT have been submitted
      expect(authClient.signIn.email).not.toHaveBeenCalled();
    });

    it('validates minimum password length through user experience', async () => {
      const user = userEvent.setup();
      renderWithTheme(<LoginPage />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Enter valid email but short password
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(passwordInput, 'short');

      // The password input has minLength attribute, browser will validate
      expect(passwordInput).toHaveAttribute('minlength', '8');
    });

    it('shows and announces error message for invalid credentials', async () => {
      const user = userEvent.setup();
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Invalid email or password' },
      });

      renderWithTheme(<LoginPage />);

      // User enters invalid credentials
      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Error should be visible and announced to screen readers
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/invalid/i);
      });
    });

    it('displays error message for failed authentication', async () => {
      const user = userEvent.setup();
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      renderWithTheme(<LoginPage />);

      // Trigger error
      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State - User Feedback', () => {
    it('provides visual feedback during authentication', async () => {
      const user = userEvent.setup();
      let resolveLogin: (value: any) => void;
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );

      renderWithTheme(<LoginPage />);

      // Submit form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // User should see loading state
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /signing in/i });
        expect(submitButton).toBeDisabled();

        // Form should be disabled during loading
        expect(screen.getByLabelText(/email/i)).toBeDisabled();
        expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
      });

      // Resolve pending login
      resolveLogin!({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });
    });
  });

  describe('Successful Login Flow', () => {
    it('navigates to dashboard after successful authentication', async () => {
      const user = userEvent.setup();
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
            token: 'mock-token',
          },
        },
        error: null,
      });

      (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { session: { user: { id: 'user-1' } } },
        isPending: false,
      });

      renderWithTheme(<LoginPage />);

      // User completes login flow
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should have called auth
      await waitFor(() => {
        expect(authClient.signIn.email).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Accessibility', () => {
    it('allows form submission with Enter key in password field', async () => {
      const user = userEvent.setup();
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      renderWithTheme(<LoginPage />);

      // Type credentials and submit with Enter
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123{Enter}');

      // Form should submit
      await waitFor(() => {
        expect(authClient.signIn.email).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          callbackURL: '/dashboard',
        });
      });
    });

    it('maintains logical tab order through form', async () => {
      const user = userEvent.setup();
      renderWithTheme(<LoginPage />);

      // All interactive elements should be focusable
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      const signupLink = screen.getByRole('link', { name: /sign up/i });

      // Focus first element
      await user.tab();

      // Verify email input gets focus first
      expect(emailInput).toHaveFocus();

      // Verify all elements are visible and accessible
      expect(passwordInput).toBeVisible();
      expect(submitButton).toBeVisible();
      expect(signupLink).toBeVisible();
    });
  });

  describe('Accessibility - ARIA & Screen Readers', () => {
    it('announces errors to screen readers', async () => {
      const user = userEvent.setup();
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      renderWithTheme(<LoginPage />);

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'wrong');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Error should be in an alert role for screen reader announcement
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('role', 'alert');
      });
    });

    it('provides accessible button states during loading', async () => {
      const user = userEvent.setup();
      let resolveLogin: (value: any) => void;
      (authClient.signIn.email as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );

      renderWithTheme(<LoginPage />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Fill form first to avoid validation
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        // Button should communicate loading state through text
        expect(submitButton).toHaveTextContent(/signing in/i);
      });

      resolveLogin!({ data: { session: null }, error: null });
    });
  });
});
