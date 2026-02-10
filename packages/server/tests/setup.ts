/**
 * Test setup configuration
 * Configures Vitest with PGLite in-memory PostgreSQL database
 *
 * Uses PGLite - an in-memory PostgreSQL implementation using WASM.
 * This eliminates Docker dependency while using a real PostgreSQL-compatible database.
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '../src/db/schema.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Test database connection
let testDb: PGlite | null = null;
let testDbClient: ReturnType<typeof drizzle> | null = null;

// Test upload directory
const testUploadDir = path.join(process.cwd(), 'test-uploads');

/**
 * Get test database client
 */
export function getTestDb() {
  if (!testDbClient) {
    throw new Error('Test database not initialized. Call beforeAll() first.');
  }
  return testDbClient;
}

/**
 * Get raw SQL client
 */
export function getTestDbRaw() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call beforeAll() first.');
  }
  return testDb;
}

/**
 * Get test upload directory
 */
export function getTestUploadDir() {
  return testUploadDir;
}

/**
 * Setup test database
 */
beforeAll(async () => {
  console.log('[Test Setup] Initializing PGLite in-memory database...');

  // Create PGLite client (in-memory PostgreSQL)
  testDb = new PGlite();
  testDbClient = drizzle(testDb, { schema });

  // Push schema to the in-memory database using drizzle-kit/api
  // This uses require() because drizzle-kit/api doesn't support ESM
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { pushSchema } = require('drizzle-kit/api');

  console.log('[Test Setup] Pushing schema to in-memory database...');
  const { apply } = await pushSchema(schema, testDbClient as any);
  await apply();
  console.log('[Test Setup] Schema pushed successfully');

  // Create test upload directory
  if (!existsSync(testUploadDir)) {
    mkdirSync(testUploadDir, { recursive: true });
    console.log(`[Test Setup] Created test upload directory: ${testUploadDir}`);
  }
});

/**
 * Setup each test with clean state
 */
beforeEach(async () => {
  if (!testDb || !testDbClient) {
    return;
  }

  // Start transaction for test isolation
  await testDb.exec('BEGIN');

  // Clear all test data in correct order (respecting foreign keys)
  await testDbClient.delete(schema.journalNotes);
  await testDbClient.delete(schema.transcripts);
  await testDbClient.delete(schema.notes);
  await testDbClient.delete(schema.templates);
  await testDbClient.delete(schema.journals);
  await testDbClient.delete(schema.sessions);
  await testDbClient.delete(schema.accounts);
  await testDbClient.delete(schema.verifications);
  await testDbClient.delete(schema.users);
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  if (!testDb) {
    return;
  }

  // Rollback transaction to undo any changes
  await testDb.exec('ROLLBACK');
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  // Close database connection
  if (testDb) {
    await testDb.close();
    testDb = null;
    testDbClient = null;
    console.log('[Test Setup] PGLite database connection closed');
  }

  // Clean up test upload directory
  if (existsSync(testUploadDir)) {
    try {
      rmSync(testUploadDir, { recursive: true, force: true });
      console.log('[Test Setup] Test upload directory cleaned up');
    } catch (error) {
      console.warn('[Test Setup] Failed to clean up test upload directory:', error);
    }
  }
});
