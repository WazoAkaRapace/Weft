import { migrate } from 'drizzle-orm/postgres-js/migrator';
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
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}
