/**
 * Request Context
 *
 * Provides a secure way to pass authenticated user context to tools
 * without allowing the agent to specify the userId.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  userId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with a request context containing the authenticated user ID.
 * Tools can access this context to get the userId securely.
 */
export function withRequestContext<T>(userId: string, fn: () => T): T {
  return asyncLocalStorage.run({ userId }, fn);
}

/**
 * Get the current request context.
 * Returns null if called outside of a request context.
 */
export function getRequestContext(): RequestContext | null {
  return asyncLocalStorage.getStore() || null;
}

/**
 * Get the authenticated user ID from the request context.
 * Throws if called outside of a request context.
 */
export function getAuthenticatedUserId(): string {
  const context = getRequestContext();
  if (!context) {
    throw new Error("No request context available - userId cannot be determined");
  }
  return context.userId;
}
