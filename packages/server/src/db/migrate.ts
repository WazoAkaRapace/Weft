import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the migrations folder path relative to the dist directory
// When running from dist/index.js, we need to look for drizzle/ at the package root
const migrationsFolder = join(__dirname, '../../drizzle');

/**
 * Reset migration tracking
 *
 * This is a recovery mechanism for when migrations fail partway through.
 * It drops the drizzle schema and migration table so migrations can be re-run.
 */
async function resetMigrationTracking() {
  try {
    // Drop the failed migration tracking
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    console.log('Reset migration tracking - migrations will be re-run');
  } catch {
    // If dropping fails, the schema might not exist yet, which is fine
    console.log('Note: Could not reset migration tracking (may not exist yet)');
  }
}

/**
 * Run database migrations
 *
 * This function applies all pending migrations to the database.
 * It should be called when the server starts up.
 *
 * Migrations are read from the `drizzle` directory and applied
 * in the order they were created.
 */
export async function runMigrations() {
  try {
    console.log('Running database migrations...');
    console.log(`Migrations folder: ${migrationsFolder}`);

    // Check if we need to reset migration tracking due to a previous failed migration
    // We do this by checking if the migration exists but the tables don't
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'drizzle'
          AND table_name = '__drizzle_migrations'
        )
      `);
      const hasMigrationTracking = result[0]?.exists || false;

      if (hasMigrationTracking) {
        // Check if the main tables exist
        const tablesExist = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'users'
          )
        `);
        const tablesCreated = tablesExist[0]?.exists || false;

        if (!tablesCreated) {
          // Migration tracking exists but tables don't - reset and try again
          console.log('Detected partial migration - resetting...');
          await resetMigrationTracking();
        }
      }
    } catch {
      // If we can't check, continue with normal migration
      console.log('Could not check migration status, proceeding normally...');
    }

    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}
