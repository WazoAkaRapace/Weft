import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, APIError } from 'better-auth/api';
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
 * Environment validation for production security
 * Throws error if critical secrets are missing in production
 */
function validateAuthEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error(
        'BETTER_AUTH_SECRET environment variable is required in production. ' +
          'Generate a secure secret with: openssl rand -base64 32'
      );
    }

    if (process.env.BETTER_AUTH_SECRET.length < 32) {
      throw new Error(
        'BETTER_AUTH_SECRET must be at least 32 characters long for security.'
      );
    }

    if (!process.env.BETTER_AUTH_URL) {
      throw new Error(
        'BETTER_AUTH_URL environment variable is required in production.'
      );
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error(
        'FRONTEND_URL environment variable is required in production.'
      );
    }
  }
}

// Validate environment on module load
validateAuthEnvironment();

/**
 * Determine if secure cookies should be used
 * Enabled in production, disabled in development
 */
function shouldUseSecureCookies(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  // Also check if the base URL uses HTTPS
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
  const isHttps = baseUrl.startsWith('https://');
  return isProduction || isHttps;
}

/**
 * Get trusted origins from environment
 * Falls back to localhost URLs in development only
 */
function getTrustedOrigins(): string[] {
  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3001';

  if (frontendUrl) {
    // In production, only use explicitly configured origins
    return [frontendUrl, backendUrl];
  }

  // Development fallback
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }

  // Production without FRONTEND_URL is an error (caught by validateAuthEnvironment)
  return [backendUrl];
}

/**
 * Better Auth configuration
 *
 * Provides authentication for the Weft application with:
 * - Email & password authentication
 * - Session management
 * - Drizzle ORM integration
 * - Production-secure defaults
 *
 * Environment variables:
 * - BETTER_AUTH_SECRET: Secret key for encryption (required in production, min 32 chars)
 * - BETTER_AUTH_URL: Base URL of the auth server (required in production)
 * - FRONTEND_URL: Frontend URL for trusted origins (required in production)
 * - NODE_ENV: Set to 'production' for secure defaults
 */
export const auth = betterAuth({
  // Use development secret only in development mode (explicitly not production)
  secret:
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV === 'production'
      ? undefined // Will cause error in validateAuthEnvironment
      : 'development-secret-key-not-for-production-use'),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  trustedOrigins: getTrustedOrigins(),
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
    // Only require email verification if explicitly enabled via env var
    // This allows production deployments without email service to work
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    sendResetPassword: async ({ user, url }: EmailCallbackParams) => {
      // TODO: Implement email sending for password reset
      if (process.env.NODE_ENV !== 'production') {
        console.log('Password reset requested for:', user.email, 'URL:', url);
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: false, // Disable cookie cache to prevent issues
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: shouldUseSecureCookies(),
    database: {
      // Use crypto.randomUUID() to generate proper UUID v4 IDs
      generateId: () => crypto.randomUUID(),
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Block signup if at least one user already exists
      if (ctx.path === '/sign-up/email') {
        const existingUsers = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .limit(1);

        if (existingUsers.length > 0) {
          throw new APIError('FORBIDDEN', {
            message: 'Registration is disabled. A user already exists in the system.',
          });
        }
      }
    }),
  },
});
