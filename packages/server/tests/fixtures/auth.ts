/**
 * Authentication test fixtures
 * Provides helper functions for creating test users and sessions
 */

import { randomUUID } from 'node:crypto';
import { getTestDb } from '../setup.js';
import * as schema from '../../src/db/schema.js';
import type { NewUser, NewSession } from '../../src/db/schema.js';

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<NewUser> = {}) {
  const db = getTestDb();

  const userId = overrides.id || randomUUID();
  const now = new Date();

  const userData: NewUser = {
    id: userId,
    email: overrides.email || 'test@example.com',
    username: overrides.username || 'testuser',
    name: overrides.name || 'Test User',
    emailVerified: overrides.emailVerified ?? false,
    passwordHash: overrides.passwordHash || 'hashed-password',
    image: overrides.image || null,
    preferredLanguage: overrides.preferredLanguage || 'en',
    transcriptionModel: overrides.transcriptionModel || 'Xenova/whisper-small',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };

  const users = await db
    .insert(schema.users)
    .values(userData)
    .returning();

  return users[0];
}

/**
 * Create a test session for a user
 */
export async function createTestSession(userId: string, overrides: Partial<NewSession> = {}) {
  const db = getTestDb();

  const sessionId = overrides.id || randomUUID();
  const now = new Date();
  const expiresAt = overrides.expiresAt || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessionData: NewSession = {
    id: sessionId,
    userId,
    expiresAt,
    token: overrides.token || `test-session-token-${randomUUID()}`,
    ipAddress: overrides.ipAddress || '127.0.0.1',
    userAgent: overrides.userAgent || 'test-user-agent',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };

  const sessions = await db
    .insert(schema.sessions)
    .values(sessionData)
    .returning();

  return sessions[0];
}

/**
 * Create authenticated user with session
 */
export async function createAuthenticatedUser(overrides: Partial<NewUser> = {}) {
  const user = await createTestUser(overrides);
  const session = await createTestSession(user.id);

  return { user, session };
}

/**
 * Generate auth headers for a session token
 */
export function getAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a mock request with auth headers
 */
export function createAuthenticatedRequest(token: string, url: string, options: RequestInit = {}) {
  return new Request(url, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers,
    },
  });
}
