import { createAuthClient } from 'better-auth/react';
import { getApiUrl } from './config';

/**
 * Better Auth client configuration
 *
 * Provides authentication methods for the React frontend.
 * Uses getApiUrl() to support runtime configuration via Docker environment variables.
 */
export const authClient = createAuthClient({
  // Note: This is evaluated at module load time, so we use a getter pattern
  // to ensure the runtime config is read when actually needed
  get baseURL() {
    return `${getApiUrl()}/api/auth`;
  },
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
