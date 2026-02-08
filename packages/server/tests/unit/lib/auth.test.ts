/**
 * DEPRECATED: This file has been replaced by tests/integration/routes/auth-api.test.ts
 *
 * The previous version of this file tested authentication by directly manipulating
 * the database, which bypassed the application layer. This is an anti-pattern because:
 *
 * 1. It tests implementation details rather than user-visible behavior
 * 2. It doesn't verify the actual auth endpoints work correctly
 * 3. It can miss bugs in the API layer (routing, headers, etc.)
 *
 * The new auth-api.test.ts file properly tests authentication through the actual
 * Better Auth API endpoints (auth.handler), which provides:
 *
 * 1. True end-to-end testing of the authentication flow
 * 2. Verification of API contracts and error handling
 * 3. Testing of actual user behavior (signup, sign-in, sign-out)
 * 4. Authorization testing across protected endpoints
 *
 * Run the proper tests with:
 *   pnpm test auth-api
 */

import { describe, it } from 'vitest';

describe('DEPRECATED: Authentication Library (Direct DB Tests)', () => {
  it('should use tests/integration/routes/auth-api.test.ts instead', () => {
    // This test is a placeholder to direct developers to the proper test file
    expect(true).toBe(true);
  });

  it('old tests bypassed application layer - see auth-api.test.ts for proper tests', () => {
    expect(true).toBe(true);
  });
});
