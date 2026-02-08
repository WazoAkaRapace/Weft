/**
 * Test setup configuration
 * Configures Vitest with test database and global fixtures
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Test database connection
let testDb: postgres.Sql<Record<string, never>> | null = null;
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
  // Use TEST_DATABASE_URL or fall back to DATABASE_URL with test suffix
  const dbUrl = process.env.TEST_DATABASE_URL ||
                process.env.DATABASE_URL?.replace('/weft', '/weft_test') ||
                'postgres://localhost:5432/weft_test';

  console.log(`[Test Setup] Connecting to test database: ${dbUrl}`);

  testDb = postgres(dbUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  testDbClient = drizzle(testDb, { schema });

  try {
    // Run migrations if not already applied
    const migrationsDir = path.join(process.cwd(), 'drizzle');
    if (existsSync(migrationsDir)) {
      console.log('[Test Setup] Running database migrations...');
      await migrate(testDbClient, { migrationsFolder: migrationsDir });
      console.log('[Test Setup] Migrations completed');
    } else {
      console.log('[Test Setup] No migrations directory found, skipping migrations');
    }
  } catch (error) {
    console.error('[Test Setup] Migration error:', error);
    // Continue even if migrations fail - schema may already exist
  }

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
  await testDb.unsafe('BEGIN');

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
  await testDb.unsafe('ROLLBACK');
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  // Close database connection
  if (testDb) {
    await testDb.end();
    testDb = null;
    testDbClient = null;
    console.log('[Test Setup] Database connection closed');
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
