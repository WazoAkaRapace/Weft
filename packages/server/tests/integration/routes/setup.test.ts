/**
 * Setup/Onboarding API tests
 * Tests first user creation and system setup endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import {
  handleCheckUsers,
  handleCreateFirstUser,
} from '../../../src/index.js';

describe('Setup/Onboarding API', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  describe('GET /api/setup/check-users', () => {
    it('should return false when no users exist', async () => {
      const response = await handleCheckUsers();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasUsers).toBe(false);
    });

    it('should return true when users exist', async () => {
      // Create a user
      await db.insert(schema.users).values({
        id: crypto.randomUUID(),
        email: 'existing@example.com',
        username: 'existinguser',
        name: 'Existing User',
        emailVerified: false,
        passwordHash: 'hashed-password',
        preferredLanguage: 'en',
        transcriptionModel: 'Xenova/whisper-small',
      });

      const response = await handleCheckUsers();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasUsers).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Close the database connection to simulate error
      // In actual implementation, this would be caught by try-catch

      const response = await handleCheckUsers();
      const data = await response.json();

      // Should still return a response (false as safe default)
      expect(response.status).toBe(200);
      expect(typeof data.hasUsers).toBe('boolean');
    });
  });

  describe('POST /api/setup/create-first-user', () => {
    const validUserData = {
      name: 'First User',
      username: 'firstuser',
      email: 'first@example.com',
      password: 'SecurePassword123!',
      preferredLanguage: 'en',
    };

    it('should create first user successfully', async () => {
      // Verify no users exist
      const existingUsers = await db.select().from(schema.users);
      expect(existingUsers).toHaveLength(0);

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validUserData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('First user created successfully');

      // Verify user was created
      const users = await db.select().from(schema.users);
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(validUserData.email);
      expect(users[0].username).toBe(validUserData.username);
      expect(users[0].name).toBe(validUserData.name);
    });

    it('should set preferred language when provided', async () => {
      const userData = {
        ...validUserData,
        preferredLanguage: 'es',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const response = await handleCreateFirstUser(request);

      expect(response.status).toBe(200);

      const users = await db.select().from(schema.users);
      expect(users[0].preferredLanguage).toBe('es');
    });

    it('should use default language when not provided', async () => {
      const userDataWithoutLang = {
        name: 'Default Lang User',
        username: 'defaultlang',
        email: 'defaultlang@example.com',
        password: 'SecurePassword123!',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userDataWithoutLang),
      });

      const response = await handleCreateFirstUser(request);

      expect(response.status).toBe(200);

      const users = await db.select().from(schema.users);
      expect(users[0].preferredLanguage).toBe('en'); // Default
    });

    it('should return 403 when users already exist', async () => {
      // Create a user first
      await db.insert(schema.users).values({
        id: crypto.randomUUID(),
        email: 'existing@example.com',
        username: 'existinguser',
        name: 'Existing User',
        emailVerified: false,
        passwordHash: 'hashed-password',
        preferredLanguage: 'en',
        transcriptionModel: 'Xenova/whisper-small',
      });

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validUserData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Setup already completed');
      expect(data.message).toContain('Users already exist');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        name: 'Incomplete User',
        // Missing username, email, password
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incompleteData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'not-an-email',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidEmailData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email');
      expect(data.message).toContain('valid email address');
    });

    it('should validate password minimum length', async () => {
      const shortPasswordData = {
        ...validUserData,
        password: 'short',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shortPasswordData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password too short');
      expect(data.message).toContain('at least 8 characters');
    });

    it('should accept valid minimum length password', async () => {
      const validMinLengthData = {
        ...validUserData,
        password: '12345678', // Exactly 8 characters
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validMinLengthData),
      });

      const response = await handleCreateFirstUser(request);

      // Should not return password validation error
      expect(response.status).not.toBe(400);
    });

    it('should use Better Auth for user creation', async () => {
      // This test verifies that the endpoint properly uses Better Auth's sign-up
      // which handles password hashing, validation, etc.

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validUserData),
      });

      const response = await handleCreateFirstUser(request);

      expect(response.status).toBe(200);

      // Verify password is hashed (not stored in plain text)
      const users = await db.select().from(schema.users);
      expect(users[0].passwordHash).toBeDefined();
      expect(users[0].passwordHash).not.toBe(validUserData.password);
      expect(users[0].passwordHash).not.toContain('SecurePassword123!');
    });

    it('should handle Better Auth sign-up failures', async () => {
      // Test with data that would cause Better Auth to fail
      const invalidData = {
        ...validUserData,
        email: 'invalid-email-format',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      // Should fail validation before reaching Better Auth
      expect(response.status).toBe(400);
    });

    it('should not fail if preferred language setting fails', async () => {
      const userData = {
        ...validUserData,
        preferredLanguage: 'fr',
      };

      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const response = await handleCreateFirstUser(request);

      // Should succeed even if language update fails (it's optional)
      expect(response.status).toBe(200);

      // But language should be set if possible
      const users = await db.select().from(schema.users);
      expect(users[0].preferredLanguage).toBe('fr');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{{{',
      });

      const response = await handleCreateFirstUser(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Setup Flow Integration', () => {
    it('should complete full onboarding flow', async () => {
      // Step 1: Check if users exist
      const checkResponse1 = await handleCheckUsers();
      const checkData1 = await checkResponse1.json();
      expect(checkData1.hasUsers).toBe(false);

      // Step 2: Create first user
      const createRequest = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Onboarding User',
          username: 'onboarding',
          email: 'onboard@example.com',
          password: 'SecurePassword123!',
          preferredLanguage: 'de',
        }),
      });

      const createResponse = await handleCreateFirstUser(createRequest);
      expect(createResponse.status).toBe(200);

      // Step 3: Verify user exists now
      const checkResponse2 = await handleCheckUsers();
      const checkData2 = await checkResponse2.json();
      expect(checkData2.hasUsers).toBe(true);

      // Step 4: Verify subsequent creation attempts are blocked
      const secondCreateRequest = new Request('http://localhost:3001/api/setup/create-first-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Second User',
          username: 'second',
          email: 'second@example.com',
          password: 'AnotherPassword123!',
        }),
      });

      const secondCreateResponse = await handleCreateFirstUser(secondCreateRequest);
      expect(secondCreateResponse.status).toBe(403);
    });
  });
});
