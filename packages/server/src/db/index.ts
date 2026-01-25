import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * Database connection configuration
 *
 * Connection pool settings for optimal performance:
 * - max: Maximum number of connections in the pool
 * - idle_timeout: Time in seconds before closing idle connections
 * - connect_timeout: Maximum time in seconds to wait for connection
 */

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/weft';

// Connection pool configuration
const poolConfig = {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Maximum time to wait for connection (seconds)
};

// Create postgres client with connection pooling
const client = postgres(DATABASE_URL, poolConfig);

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

/**
 * Graceful shutdown handler
 * Closes all database connections
 */
export async function closeDatabase() {
  await client.end();
}

/**
 * Health check function
 * Returns true if database connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Database connection information
 */
export const dbConfig = {
  url: DATABASE_URL,
  pool: {
    max: poolConfig.max,
    idleTimeout: poolConfig.idle_timeout,
    connectTimeout: poolConfig.connect_timeout,
  },
};

// Export schema for use in queries
export { schema };
export * from './schema.js';
