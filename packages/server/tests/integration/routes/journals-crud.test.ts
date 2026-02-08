/**
 * Journal CRUD API tests
 * Tests journal creation, reading, updating, and deletion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import { createTestJournal } from '../../fixtures/db.js';
import {
  handleGetJournals,
  handleGetJournal,
  handleGetPaginatedJournals,
  handleUpdateJournal,
  handleDeleteJournal,
  handleGetTranscript,
  handleRetryTranscription,
  handleGetJobsStatus,
} from '../../../src/routes/journals.js';

describe('Journal CRUD API', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    db = getTestDb();

    // Create authenticated user
    testUser = await createTestUser({
      email: 'journal@example.com',
      username: 'journaluser',
      name: 'Journal User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-journal-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('GET /api/journals', () => {
    it('should return all journals for authenticated user', async () => {
      // Create test journals
      await createTestJournal(testUser.id, { title: 'Journal 1' });
      await createTestJournal(testUser.id, { title: 'Journal 2' });

      const request = new Request('http://localhost:3001/api/journals', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toBeDefined();
      expect(data.journals).toHaveLength(2);
      expect(data.journals[0].title).toBe('Journal 1');
      expect(data.journals[1].title).toBe('Journal 2');
    });

    it('should return only user-owned journals', async () => {
      // Create journals for test user
      await createTestJournal(testUser.id, { title: 'My Journal' });

      // Create another user with journals
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        name: 'Other User',
      });
      await createTestJournal(otherUser.id, { title: 'Other Journal' });

      const request = new Request('http://localhost:3001/api/journals', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toHaveLength(1);
      expect(data.journals[0].title).toBe('My Journal');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/journals');

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array for user with no journals', async () => {
      const request = new Request('http://localhost:3001/api/journals', {
        headers: authHeaders,
      });

      const response = await handleGetJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journals).toHaveLength(0);
    });
  });

  describe('GET /api/journals/paginated', () => {
    beforeEach(async () => {
      // Create multiple journals for pagination testing
      for (let i = 1; i <= 25; i++) {
        await createTestJournal(testUser.id, {
          title: `Journal ${i}`,
          createdAt: new Date(Date.now() + i * 1000), // Stagger times
        });
      }
    });

    it('should return paginated journals', async () => {
      const url = new URL('http://localhost:3001/api/journals/paginated?page=1&limit=10');

      const request = new Request(url.toString(), {
        headers: authHeaders,
      });

      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(10);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.currentPage).toBe(1);
      expect(data.pagination.totalItems).toBe(25);
      expect(data.pagination.totalPages).toBe(3);
      expect(data.pagination.itemsPerPage).toBe(10);
      expect(data.pagination.hasNextPage).toBe(true);
      expect(data.pagination.hasPreviousPage).toBe(false);
    });

    it('should respect page parameter', async () => {
      const url = new URL('http://localhost:3001/api/journals/paginated?page=2&limit=10');

      const request = new Request(url.toString(), {
        headers: authHeaders,
      });

      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(10);
      expect(data.pagination.currentPage).toBe(2);
      expect(data.pagination.hasPreviousPage).toBe(true);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() + 5 * 1000).toISOString();
      const endDate = new Date(Date.now() + 15 * 1000).toISOString();

      const url = new URL(`http://localhost:3001/api/journals/paginated?startDate=${startDate}&endDate=${endDate}`);

      const request = new Request(url.toString(), {
        headers: authHeaders,
      });

      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data.length).toBeLessThanOrEqual(11); // Journals 5-15
    });

    it('should support text search', async () => {
      const url = new URL('http://localhost:3001/api/journals/paginated?search=Journal 5');

      const request = new Request(url.toString(), {
        headers: authHeaders,
      });

      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.some((j: any) => j.title.includes('5'))).toBe(true);
    });

    it('should limit to maximum 100 items per page', async () => {
      const url = new URL('http://localhost:3001/api/journals/paginated?limit=200');

      const request = new Request(url.toString(), {
        headers: authHeaders,
      });

      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.itemsPerPage).toBe(100);
    });
  });

  describe('GET /api/journals/:id', () => {
    it('should return specific journal by ID', async () => {
      const journal = await createTestJournal(testUser.id, {
        title: 'Specific Journal',
        notes: 'Test notes',
      });

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        headers: authHeaders,
      });

      const response = await handleGetJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(journal.id);
      expect(data.title).toBe('Specific Journal');
      expect(data.notes).toBe('Test notes');
    });

    it('should return 403 for other user\'s journal', async () => {
      const otherUser = await createTestUser({
        email: 'othercrud@example.com',
        username: 'othercrud',
        name: 'Other CRUD User',
      });

      const journal = await createTestJournal(otherUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        headers: authHeaders,
      });

      const response = await handleGetJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 for non-existent journal', async () => {
      const fakeId = randomUUID();

      const request = new Request(`http://localhost:3001/api/journals/${fakeId}`, {
        headers: authHeaders,
      });

      const response = await handleGetJournal(request, fakeId);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Journal not found');
    });
  });

  describe('PUT /api/journals/:id', () => {
    it('should update journal fields', async () => {
      const journal = await createTestJournal(testUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Updated Title',
          notes: 'Updated notes',
          location: 'San Francisco',
          manualMood: 'happy',
        }),
      });

      const response = await handleUpdateJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Title');
      expect(data.notes).toBe('Updated notes');
      expect(data.location).toBe('San Francisco');
      expect(data.manualMood).toBe('happy');
      expect(data.updatedAt).not.toBe(journal.updatedAt);
    });

    it('should update only provided fields', async () => {
      const journal = await createTestJournal(testUser.id, {
        title: 'Original Title',
        notes: 'Original notes',
      });

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Title',
        }),
      });

      const response = await handleUpdateJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');
      expect(data.notes).toBe('Original notes'); // Unchanged
    });

    it('should return 403 when updating other user\'s journal', async () => {
      const otherUser = await createTestUser({
        email: 'otherupdate@example.com',
        username: 'otherupdate',
        name: 'Other Update User',
      });

      const journal = await createTestJournal(otherUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Hacked Title' }),
      });

      const response = await handleUpdateJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/journals/:id', () => {
    it('should delete journal and return success', async () => {
      const journal = await createTestJournal(testUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteJournal(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Journal deleted successfully');

      // Verify journal is deleted
      const journals = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      expect(journals).toHaveLength(0);
    });

    it('should return 403 when deleting other user\'s journal', async () => {
      const otherUser = await createTestUser({
        email: 'otherdelete@example.com',
        username: 'otherdelete',
        name: 'Other Delete User',
      });

      const journal = await createTestJournal(otherUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteJournal(request, journal.id);

      expect(response.status).toBe(403);

      // Verify journal still exists
      const journals = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      expect(journals).toHaveLength(1);
    });

    it('should return 404 for non-existent journal', async () => {
      const fakeId = randomUUID();

      const request = new Request(`http://localhost:3001/api/journals/${fakeId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteJournal(request, fakeId);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Journal not found');
    });
  });

  describe('GET /api/journals/:id/transcript', () => {
    it('should return journal transcript', async () => {
      const journal = await createTestJournal(testUser.id);

      await db.insert(schema.transcripts).values({
        id: randomUUID(),
        journalId: journal.id,
        text: 'Full transcript text here',
        segments: [
          { start: 0, end: 2.5, text: 'Full transcript' },
          { start: 2.5, end: 5.0, text: 'text here' },
        ],
      });

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/transcript`, {
        headers: authHeaders,
      });

      const response = await handleGetTranscript(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Full transcript text here');
      expect(data.segments).toHaveLength(2);
    });

    it('should return 404 when transcript does not exist', async () => {
      const journal = await createTestJournal(testUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/transcript`, {
        headers: authHeaders,
      });

      const response = await handleGetTranscript(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transcript not found');
    });
  });

  describe('POST /api/journals/:id/transcription/retry', () => {
    it('should queue retry transcription', async () => {
      const journal = await createTestJournal(testUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/transcription/retry`, {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleRetryTranscription(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.data.message).toBe('Transcription queued');
      expect(data.data.jobId).toBeDefined();
    });

    it('should delete existing transcript before retry', async () => {
      const journal = await createTestJournal(testUser.id);

      const transcriptId = randomUUID();
      await db.insert(schema.transcripts).values({
        id: transcriptId,
        journalId: journal.id,
        text: 'Old transcript',
        segments: [],
      });

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/transcription/retry`, {
        method: 'POST',
        headers: authHeaders,
      });

      await handleRetryTranscription(request, journal.id);

      // Verify old transcript was deleted
      const transcripts = await db
        .select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.id, transcriptId));

      expect(transcripts).toHaveLength(0);
    });
  });

  describe('GET /api/journals/:id/jobs', () => {
    it('should return job statuses for journal', async () => {
      const journal = await createTestJournal(testUser.id, {
        dominantEmotion: 'happy',
        emotionTimeline: [{ time: 0, emotion: 'happy', confidence: 0.9 }],
        emotionScores: { happy: 0.8, neutral: 0.2 },
      });

      // Add transcript
      await db.insert(schema.transcripts).values({
        id: randomUUID(),
        journalId: journal.id,
        text: 'Test transcript',
        segments: [],
      });

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/jobs`, {
        headers: authHeaders,
      });

      const response = await handleGetJobsStatus(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transcription).toBeDefined();
      expect(data.emotion).toBeDefined();
      expect(data.transcription.status).toBe('completed');
      expect(data.emotion.status).toBe('completed');
    });

    it('should return pending status when no jobs exist', async () => {
      const journal = await createTestJournal(testUser.id);

      const request = new Request(`http://localhost:3001/api/journals/${journal.id}/jobs`, {
        headers: authHeaders,
      });

      const response = await handleGetJobsStatus(request, journal.id);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transcription).toBeNull();
      expect(data.emotion).toBeNull();
    });
  });
});
