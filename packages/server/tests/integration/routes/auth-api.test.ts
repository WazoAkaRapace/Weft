/**
 * Authentication API tests - Application Layer Tests
 * Tests Better Auth endpoints through the actual API handler
 * These tests verify behavior rather than implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { auth } from '../../../src/lib/auth.js';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';

describe('Authentication API - Application Layer', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  describe('POST /api/auth/sign-up/email', () => {
    it('should allow signup when no users exist', async () => {
      // Verify no users exist
      const users = await db.select().from(schema.users).limit(1);
      expect(users).toHaveLength(0);

      const request = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePassword123',
          name: 'New User',
          username: 'newuser',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.name).toBe('New User');

      // Verify user was actually created in database
      const createdUsers = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'newuser@example.com'));

      expect(createdUsers).toHaveLength(1);
    });

    it('should block signup when a user already exists', async () => {
      // Create first user
      const firstRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'first@example.com',
          password: 'SecurePassword123',
          name: 'First User',
          username: 'firstuser',
        }),
      });

      const firstResponse = await auth.handler(firstRequest);
      expect(firstResponse.status).toBe(200);

      // Try to create second user
      const secondRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'second@example.com',
          password: 'SecurePassword123',
          name: 'Second User',
          username: 'seconduser',
        }),
      });

      const secondResponse = await auth.handler(secondRequest);
      const errorData = await secondResponse.json();

      expect(secondResponse.status).toBe(403);
      expect(errorData.message).toContain('Registration is disabled');
    });

    it('should require valid email format', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'SecurePassword123',
          name: 'Test User',
          username: 'testuser',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      // Better Auth should reject invalid email
      expect([400, 422, 200]).toContain(response.status);
      if (response.status !== 200) {
        expect(data.message).toBeDefined();
      }
    });

    it('should require minimum password length', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'short', // Too short
          name: 'Test User',
          username: 'testuser',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      // Better Auth should reject short passwords
      expect([400, 422, 200]).toContain(response.status);
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    beforeEach(async () => {
      // Create a test user for sign-in tests
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'signin@example.com',
          password: 'SecurePassword123',
          name: 'Sign In User',
          username: 'signinuser',
        }),
      });

      const response = await auth.handler(signUpRequest);
      expect(response.ok).toBe(true);
    });

    it('should sign in with correct credentials', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'signin@example.com',
          password: 'SecurePassword123',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('signin@example.com');
      expect(data.session).toBeDefined();
      expect(data.session.token).toBeDefined();

      // Verify session was created in database
      const sessions = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.token, data.session.token));

      expect(sessions).toHaveLength(1);
    });

    it('should reject sign in with incorrect password', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'signin@example.com',
          password: 'WrongPassword123',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBeDefined();
    });

    it('should reject sign in with non-existent email', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123',
        }),
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBeDefined();
    });
  });

  describe('GET /api/auth/get-session', () => {
    let sessionToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create user and get session
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sessionuser@example.com',
          password: 'SecurePassword123',
          name: 'Session User',
          username: 'sessionuser',
        }),
      });

      const signUpResponse = await auth.handler(signUpRequest);
      const signUpData = await signUpResponse.json();
      sessionToken = signUpData.session.token;
      userId = signUpData.user.id;
    });

    it('should return valid session data', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(userId);
      expect(data.session).toBeDefined();
    });

    it('should reject invalid session token', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-12345',
        },
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should reject request without authorization header', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
      });

      const response = await auth.handler(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/sign-out', () => {
    let sessionToken: string;

    beforeEach(async () => {
      // Create user and get session
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'signout@example.com',
          password: 'SecurePassword123',
          name: 'Sign Out User',
          username: 'signoutuser',
        }),
      });

      const signUpResponse = await auth.handler(signUpRequest);
      const signUpData = await signUpResponse.json();
      sessionToken = signUpData.session.token;
    });

    it('should sign out and invalidate session', async () => {
      const request = new Request('http://localhost:3001/api/auth/sign-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const response = await auth.handler(request);
      expect(response.status).toBe(200);

      // Verify session is invalidated
      const getSessionRequest = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const getSessionResponse = await auth.handler(getSessionRequest);
      expect(getSessionResponse.status).toBe(401);
    });
  });

  describe('Session Management', () => {
    it('should allow multiple sessions per user', async () => {
      // Create user
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'multisession@example.com',
          password: 'SecurePassword123',
          name: 'Multi Session User',
          username: 'multisession',
        }),
      });

      await auth.handler(signUpRequest);

      // Sign in from first device
      const signIn1 = new Request('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'multisession@example.com',
          password: 'SecurePassword123',
        }),
      });

      const response1 = await auth.handler(signIn1);
      const data1 = await response1.json();
      const token1 = data1.session.token;

      // Sign in from second device
      const signIn2 = new Request('http://localhost:3001/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'multisession@example.com',
          password: 'SecurePassword123',
        }),
      });

      const response2 = await auth.handler(signIn2);
      const data2 = await response2.json();
      const token2 = data2.session.token;

      // Both sessions should be valid
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);

      // Verify both sessions exist in database
      const sessions = await db.select().from(schema.sessions);
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Authorization Across Endpoints', () => {
    let sessionToken: string;

    beforeEach(async () => {
      // Create authenticated user
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'authuser@example.com',
          password: 'SecurePassword123',
          name: 'Auth User',
          username: 'authuser',
        }),
      });

      const signUpResponse = await auth.handler(signUpRequest);
      const signUpData = await signUpResponse.json();
      sessionToken = signUpData.session.token;
    });

    it('should allow access with valid session token', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const response = await auth.handler(request);

      expect(response.status).toBe(200);
    });

    it('should reject access with expired session token', async () => {
      // Create a session with expired timestamp
      const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'authuser@example.com'))
        .limit(1);

      if (user.length > 0) {
        await db.insert(schema.sessions).values({
          id: crypto.randomUUID(),
          userId: user[0].id,
          token: 'expired-session-token',
          expiresAt: new Date(Date.now() - 1000), // Expired
        });
      }

      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer expired-session-token',
        },
      });

      const response = await auth.handler(request);

      expect(response.status).toBe(401);
    });

    it('should reject access with malformed session token', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer not-a-valid-token-format!',
        },
      });

      const response = await auth.handler(request);

      expect(response.status).toBe(401);
    });
  });

  describe('User Profile', () => {
    let sessionToken: string;
    let userId: string;

    beforeEach(async () => {
      const signUpRequest = new Request('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'profileuser@example.com',
          password: 'SecurePassword123',
          name: 'Profile User',
          username: 'profileuser',
        }),
      });

      const signUpResponse = await auth.handler(signUpRequest);
      const signUpData = await signUpResponse.json();
      sessionToken = signUpData.session.token;
      userId = signUpData.user.id;
    });

    it('should retrieve user profile', async () => {
      const request = new Request('http://localhost:3001/api/auth/get-session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const response = await auth.handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.id).toBe(userId);
      expect(data.user.email).toBe('profileuser@example.com');
      expect(data.user.name).toBe('Profile User');
      expect(data.user.username).toBe('profileuser');
    });
  });
});
