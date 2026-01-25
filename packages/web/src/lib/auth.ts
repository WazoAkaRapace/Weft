import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client configuration
 *
 * Provides authentication methods for the React frontend
 */
export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001/api/auth',
});

/**
 * Auth hooks and utilities
 */
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useUser,
} = authClient;

/**
 * Type exports for use in components
 */
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.User;
