import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client configuration
 *
 * Provides authentication methods for the React frontend
 */
export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001/api/auth',
  // Ensure cookies are properly sent with requests
  fetchOptions: {
    credentials: 'include',
  },
});

/**
 * Auth hooks and utilities
 */
export const {
  
  
  signOut,
  useSession,
  
} = authClient;

/**
 * Type exports for use in components
 */
type Session = typeof authClient.$Infer.Session;
type User = typeof authClient.$Infer.User;
