/**
 * Test setup helpers for integration tests
 * Provides utilities for mocking auth and database in tests
 */

import { vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../setup.js';
import * as schema from '../../src/db/schema.js';

/**
 * Mock Better Auth's getSession function
 * Returns a mock that validates sessions against the test database
 */
export function createMockGetSession() {
  return vi.fn(async ({ headers }: { headers: Headers }) => {
    // Extract token from Authorization header
    const authHeader = headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const db = getTestDb();

    // Look up session by token
    const result = await db
      .select({
        session: {
          id: schema.sessions.id,
          userId: schema.sessions.userId,
          expiresAt: schema.sessions.expiresAt,
          token: schema.sessions.token,
          ipAddress: schema.sessions.ipAddress,
          userAgent: schema.sessions.userAgent,
          createdAt: schema.sessions.createdAt,
          updatedAt: schema.sessions.updatedAt,
        },
        user: {
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          emailVerified: schema.users.emailVerified,
          image: schema.users.image,
          createdAt: schema.users.createdAt,
          updatedAt: schema.users.updatedAt,
        },
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.token, token))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const session = result[0];

    // Check if session is expired
    if (new Date(session.session.expiresAt) < new Date()) {
      return null;
    }

    // Return Better Auth session format
    return session;
  });
}

/**
 * Setup mocks for auth and database modules
 * Call this in beforeEach before importing route handlers
 *
 * Example usage:
 * ```ts
 * import { setupMocks } from '../helpers/testSetup.js';
 *
 * let handleGetUserSettings;
 *
 * beforeEach(async () => {
 *   setupMocks();
 *
 *   const routesModule = await import('../../src/routes/users.js');
 *   handleGetUserSettings = routesModule.handleGetUserSettings;
 * });
 * ```
 */
export function setupMocks() {
  // Mock the auth module
  vi.mock('../../src/lib/auth.js', () => ({
    auth: {
      api: {
        getSession: createMockGetSession(),
      },
    },
  }));

  // Mock the database module
  vi.doMock('../../src/db/index.js', () => ({
    db: getTestDb(),
    closeDatabase: vi.fn(),
    healthCheck: vi.fn(),
    dbConfig: {
      url: 'mock://test',
      pool: { max: 1, idleTimeout: 20, connectTimeout: 10 },
    },
    schema: schema,
  }));
}

/**
 * Create a mock for services that depend on the database
 * This is useful for unit tests that need to mock service methods
 */
export function createMockService<T extends Record<string, any>>(service: T): T {
  const mockService = {} as T;

  for (const key in service) {
    if (typeof service[key] === 'function') {
      mockService[key] = vi.fn();
    } else {
      mockService[key] = service[key];
    }
  }

  return mockService;
}
