/**
 * Database Transaction Utilities
 *
 * Provides helper functions for working with Drizzle ORM transactions.
 * Use these utilities to ensure data integrity for multi-step operations.
 */

import { db } from '../db/index.js';

/**
 * Transaction isolation levels supported by PostgreSQL
 */
export type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable';

/**
 * Transaction options for PostgreSQL
 */
export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  accessMode?: 'read only' | 'read write';
  deferrable?: boolean;
}

/**
 * Execute a callback within a database transaction
 *
 * If the callback throws an error or calls tx.rollback(), the transaction
 * will be rolled back. Otherwise, it will be committed automatically.
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   await tx.update(accounts).set({ balance: newBalance });
 *   await tx.insert(transactions).values({ amount: 100 });
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return db.transaction(callback, options as any);
}
