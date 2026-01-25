import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';

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
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}
