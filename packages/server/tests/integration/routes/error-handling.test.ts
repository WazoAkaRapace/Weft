/**
 * Error Handling and Edge Cases API tests
 * Tests error responses, edge cases, and boundary conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import {
  handleGetJournals,
  handleGetJournal,
  handleCreateJournal,
  handleUpdateJournal,
  handleDeleteJournal,
} from '../../../src/routes/journals.js';
import {
  handleGetNotes,
  handleCreateNote,
  handleUpdateNote,
} from '../../../src/routes/notes.js';
import {
  handleGetTemplates,
  handleCreateTemplate,
} from '../../../src/routes/templates.js';
import {
  handleGetUserSettings,
  handleUpdateUserSettings,
} from '../../../src/routes/users.js';

describe('Error Handling and Edge Cases', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'errors@example.com',
      username: 'errorsuser',
      name: 'Errors User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-errors-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('Authentication Edge Cases', () => {
    it('should handle malformed authorization header', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        headers: {
          'Authorization': 'InvalidFormat token',
        },
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should handle empty authorization header', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        headers: {
          'Authorization': '',
        },
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should handle authorization header with only spaces', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        headers: {
          'Authorization': '   ',
        },
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should handle multiple authorization headers', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        headers: {
          'Authorization': testSession.token,
          'authorization': 'another-token', // Case-sensitive duplicate
        },
      });

      const response = await handleGetNotes(request);
      // Should handle gracefully - either use first or reject
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Pagination Edge Cases', () => {
    beforeEach(async () => {
      // Create multiple journals for pagination testing
      for (let i = 1; i <= 25; i++) {
        await db.insert(schema.journals).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          title: `Journal ${i}`,
          videoPath: `/uploads/journal${i}.webm`,
          duration: 60,
          createdAt: new Date(Date.now() + i * 1000), // Staggered times
        });
      }
    });

    it('should handle negative page number', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=-1&limit=10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default to page 1 or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle zero page number', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=0&limit=10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default to page 1 or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle very large page number', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=999999&limit=10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toHaveLength(0); // Empty result for out-of-range page
    });

    it('should handle negative limit', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=1&limit=-10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default limit or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle zero limit', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=1&limit=0', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default limit or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle very large limit', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=1&limit=999999', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should cap at reasonable maximum or return all results
      expect(data.journals.length).toBeGreaterThan(0);
    });

    it('should handle non-numeric page parameter', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=abc&limit=10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default to page 1 or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle non-numeric limit parameter', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=1&limit=xyz', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either default limit or return error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle missing page parameter', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?limit=10', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toBeDefined();
    });

    it('should handle missing limit parameter', async () => {
      const request = new Request('http://localhost:3001/api/journals/paginated?page=1', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toBeDefined();
    });
  });

  describe('Input Validation Edge Cases', () => {
    describe('Empty and Whitespace Strings', () => {
      it('should reject note title with only whitespace', async () => {
        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: '   \n\t   ',
          }),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBeDefined();
      });

      it('should reject template title with only whitespace', async () => {
        const request = new Request('http://localhost:3001/api/templates', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: '   \n\t   ',
          }),
        });

        const response = await handleCreateTemplate(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBeDefined();
      });

      it('should accept title with leading/trailing whitespace and trim it', async () => {
        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: '  Valid Title  ',
          }),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.title).toBe('Valid Title');
      });

      it('should handle title with special characters', async () => {
        const specialTitle = 'Title with émojis 🎉 and spëcial çharacters';

        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: specialTitle,
          }),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.title).toBe(specialTitle);
      });
    });

    describe('Very Long Strings', () => {
      it('should handle very long title', async () => {
        const longTitle = 'A'.repeat(1000);

        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: longTitle,
          }),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        // Should either accept or reject with proper error
        expect([201, 400, 413]).toContain(response.status);
      });

      it('should handle very long content', async () => {
        const longContent = 'A'.repeat(100000); // 100KB

        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            title: 'Note with long content',
            content: longContent,
          }),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        // Should either accept or reject with proper error
        expect([201, 400, 413]).toContain(response.status);
      });
    });

    describe('Invalid JSON', () => {
      it('should handle malformed JSON in request body', async () => {
        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: '{invalid json}',
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        // Should handle gracefully with proper error
        expect([400, 500]).toContain(response.status);
      });

      it('should handle empty request body', async () => {
        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: '',
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        // Should handle gracefully
        expect([400, 500]).toContain(response.status);
      });

      it('should handle JSON array instead of object', async () => {
        const request = new Request('http://localhost:3001/api/notes', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(['array', 'instead', 'of', 'object']),
        });

        const response = await handleCreateNote(request);
        const data = await response.json();

        // Should handle gracefully
        expect([400, 500]).toContain(response.status);
      });
    });
  });

  describe('ID Validation Edge Cases', () => {
    it('should handle invalid UUID format', async () => {
      const request = new Request('http://localhost:3001/api/notes/not-a-uuid', {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, 'not-a-uuid');
      const data = await response.json();

      // Should return 404 for invalid ID (not found)
      expect(response.status).toBe(404);
    });

    it('should handle empty string ID', async () => {
      const request = new Request('http://localhost:3001/api/notes/', {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, '');
      const data = await response.json();

      // Should handle gracefully
      expect([400, 404]).toContain(response.status);
    });

    it('should handle SQL injection attempt in ID', async () => {
      const maliciousId = "'; DROP TABLE notes; --";

      const request = new Request(`http://localhost:3001/api/notes/${encodeURIComponent(maliciousId)}`, {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, maliciousId);
      const data = await response.json();

      // Should handle safely - not crash, return 404
      expect(response.status).toBe(404);
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    it('should handle updating same resource twice', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'Original Title',
        position: 0,
      });

      // First update
      const request1 = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'First Update',
        }),
      });

      const response1 = await handleUpdateNote(request1, noteId);
      expect(response1.status).toBe(200);

      // Second update (should work regardless of first)
      const request2 = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Second Update',
        }),
      });

      const response2 = await handleUpdateNote(request2, noteId);
      expect(response2.status).toBe(200);
    });

    it('should handle deleting already deleted resource', async () => {
      const journalId = crypto.randomUUID();

      await db.insert(schema.journals).values({
        id: journalId,
        userId: testUser.id,
        title: 'To Delete',
        videoPath: '/uploads/test.webm',
        duration: 60,
        deletedAt: new Date(), // Already deleted
      });

      const request = new Request(`http://localhost:3001/api/journals/${journalId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteJournal(request, journalId);
      const data = await response.json();

      // Should handle gracefully - either 404 or success (idempotent)
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Date and Time Edge Cases', () => {
    it('should handle date filtering with future dates', async () => {
      await db.insert(schema.journals).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Current Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
        createdAt: new Date(),
      });

      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year in future

      const request = new Request(`http://localhost:3001/api/journals?startDate=${futureDate.toISOString()}`, {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toHaveLength(0); // No journals in future
    });

    it('should handle date filtering with past dates', async () => {
      await db.insert(schema.journals).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Recent Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
        createdAt: new Date(),
      });

      const pastDate = new Date('2020-01-01');

      const request = new Request(`http://localhost:3001/api/journals?startDate=${pastDate.toISOString()}`, {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toHaveLength(1); // Should find the journal
    });

    it('should handle invalid date format', async () => {
      const request = new Request('http://localhost:3001/api/journals?startDate=invalid-date', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      // Should handle gracefully - either ignore filter or return error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Search and Filter Edge Cases', () => {
    beforeEach(async () => {
      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Meeting Notes',
        content: 'Discussed project timeline and milestones',
        position: 0,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Shopping List',
        content: 'Groceries and household items',
        position: 1,
      });
    });

    it('should handle empty search string', async () => {
      const request = new Request('http://localhost:3001/api/notes?search=', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Empty search should return all or none depending on implementation
      expect(Array.isArray(data.notes)).toBe(true);
    });

    it('should handle search with special characters', async () => {
      const request = new Request('http://localhost:3001/api/notes?search=%20%26%20%3C%20%3E', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.notes)).toBe(true);
    });

    it('should handle search with SQL wildcards', async () => {
      const request = new Request('http://localhost:3001/api/notes?search=%25%5F', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should handle safely - treat as literal characters
      expect(Array.isArray(data.notes)).toBe(true);
    });
  });

  describe('User Settings Edge Cases', () => {
    it('should handle partial settings update', async () => {
      const request = new Request('http://localhost:3001/api/user/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          preferredLanguage: 'es',
          // transcriptionModel not provided
        }),
      });

      const response = await handleUpdateUserSettings(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle empty settings update', async () => {
      const request = new Request('http://localhost:3001/api/user/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({}),
      });

      const response = await handleUpdateUserSettings(request);
      const data = await response.json();

      // Should handle gracefully - either success or no-op
      expect([200, 400]).toContain(response.status);
    });

    it('should handle invalid language code', async () => {
      const request = new Request('http://localhost:3001/api/user/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          preferredLanguage: 'xx-invalid',
        }),
      });

      const response = await handleUpdateUserSettings(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid language');
    });

    it('should handle invalid transcription model', async () => {
      const request = new Request('http://localhost:3001/api/user/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          transcriptionModel: 'invalid-model',
        }),
      });

      const response = await handleUpdateUserSettings(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid model');
    });

    it('should handle settings for deleted user', async () => {
      // Delete the user
      await db.delete(schema.users).where(eq(schema.users.id, testUser.id));

      const request = new Request('http://localhost:3001/api/user/settings', {
        headers: authHeaders,
      });

      const response = await handleGetUserSettings(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });
  });

  describe('Content Type Edge Cases', () => {
    it('should handle missing content-type header', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: {
          'Authorization': authHeaders['Authorization'] as string,
          // No Content-Type header
        },
        body: JSON.stringify({
          title: 'Test',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      // Should handle gracefully - may assume JSON or reject
      expect([201, 400, 415]).toContain(response.status);
    });

    it('should handle incorrect content-type header', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: {
          'Authorization': authHeaders['Authorization'] as string,
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          title: 'Test',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      // Should handle gracefully - may ignore or reject
      expect([201, 400, 415]).toContain(response.status);
    });
  });
});
