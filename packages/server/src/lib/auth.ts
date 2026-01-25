import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

interface EmailUser {
  email: string;
}

interface EmailCallbackParams {
  user: EmailUser;
  url: string;
}

/**
 * Better Auth configuration
 *
 * Provides authentication for the Weft application with:
 * - Email & password authentication
 * - Session management
 * - Drizzle ORM integration
 *
 * Environment variables:
 * - BETTER_AUTH_SECRET: Secret key for encryption (required, min 32 chars)
 * - BETTER_AUTH_URL: Base URL of the auth server (e.g., http://localhost:3001)
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'development-secret-key-change-in-production-min-32-chars',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }: EmailCallbackParams) => {
      // TODO: Implement email sending for password reset
      console.log('Password reset requested for:', user.email, 'URL:', url);
    },
    sendVerificationEmail: async ({ user, url }: EmailCallbackParams) => {
      // TODO: Implement email sending for verification
      console.log('Verification email for:', user.email, 'URL:', url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    cookiePrefix: 'weft',
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: false, // Disable for development
    database: {
      // Use crypto.randomUUID() to generate proper UUID v4 IDs
      generateId: () => crypto.randomUUID(),
    },
  },
});

/**
 * Export auth types for use throughout the application
 */
export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
