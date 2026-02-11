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

/**
 * Execute a callback within a serializable transaction
 *
 * Serializable isolation provides the highest level of isolation,
 * ensuring that concurrent transactions appear to execute sequentially.
 * Use this for operations that require strict consistency.
 *
 * @example
 * ```typescript
 * await withSerializableTransaction(async (tx) => {
 *   // Critical operations that need strict consistency
 * });
 * ```
 */
export async function withSerializableTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return withTransaction(callback, {
    isolationLevel: 'serializable',
  });
}

/**
 * Execute multiple operations in a transaction with automatic retry on conflict
 *
 * This is useful for operations that might conflict with concurrent transactions.
 * PostgreSQL will retry the transaction if a serialization failure occurs.
 *
 * @param callback - The operations to perform
 * @param maxRetries - Maximum number of retries (default: 3)
 */
export async function withRetryableTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withTransaction(callback, {
        isolationLevel: 'serializable',
        deferrable: true,
      });
    } catch (error) {
      const pgError = error as { code?: string };
      // PostgreSQL serialization failure error code
      if (pgError.code === '40001') {
        lastError = error as Error;
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Transaction failed after maximum retries');
}
