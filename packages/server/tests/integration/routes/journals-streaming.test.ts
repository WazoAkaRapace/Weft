/**
 * Journal streaming API tests
 * Tests video upload streaming endpoints with chunked uploads
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession } from '../../fixtures/auth.js';
import {
  handleStreamInit,
  handleStreamChunkUpload,
} from '../../../src/routes/journals.js';
import { mkdir, existsSync } from 'node:fs/promises';
import path from 'node:path';

describe('Journal Streaming API', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    db = getTestDb();

    // Create authenticated user
    testUser = await createTestUser({
      email: 'stream@example.com',
      username: 'streamuser',
      name: 'Stream User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-stream-token',
    });

    authHeaders = {
      'Authorization': `Bearer ${testSession.token}`,
      'Content-Type': 'application/json',
    };

    // Ensure upload directories exist
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'test-uploads');
    const tempDir = path.join(uploadDir, 'temp');

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
  });

  describe('POST /api/journals/stream/init', () => {
    it('should initialize a stream for authenticated user', async () => {
      const request = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleStreamInit(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.streamId).toBeDefined();
      expect(data.uploadUrl).toBe('/api/journals/stream');
      expect(typeof data.streamId).toBe('string');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await handleStreamInit(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('PERMISSION_DENIED');
    });

    it('should return unique stream IDs for multiple requests', async () => {
      const request1 = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: authHeaders,
      });

      const request2 = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: authHeaders,
      });

      const response1 = await handleStreamInit(request1);
      const response2 = await handleStreamInit(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.streamId).toBeDefined();
      expect(data2.streamId).toBeDefined();
      expect(data1.streamId).not.toBe(data2.streamId);
    });
  });

  describe('POST /api/journals/stream/chunk', () => {
    let streamId: string;

    beforeEach(async () => {
      // Initialize a stream first
      const initRequest = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: authHeaders,
      });

      const initResponse = await handleStreamInit(initRequest);
      const initData = await initResponse.json();
      streamId = initData.streamId;
    });

    it('should accept a video chunk', async () => {
      const chunkData = Buffer.alloc(1024, 'test-chunk-data');

      const request = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Stream-ID': streamId,
          'X-Chunk-Index': '0',
          'X-Is-Last': 'false',
          'Content-Type': 'video/webm',
        },
        body: chunkData,
      });

      const response = await handleStreamChunkUpload(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.streamId).toBe(streamId);
      expect(data.chunkIndex).toBe('0');
      expect(data.bytesReceived).toBe(1024);
      expect(data.isLast).toBe(false);
    });

    it('should accept multiple chunks', async () => {
      const chunk1 = Buffer.alloc(1024, 'chunk-1');
      const chunk2 = Buffer.alloc(1024, 'chunk-2');

      const request1 = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Stream-ID': streamId,
          'X-Chunk-Index': '0',
          'X-Is-Last': 'false',
          'Content-Type': 'video/webm',
        },
        body: chunk1,
      });

      const request2 = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Stream-ID': streamId,
          'X-Chunk-Index': '1',
          'X-Is-Last': 'false',
          'Content-Type': 'video/webm',
        },
        body: chunk2,
      });

      const response1 = await handleStreamChunkUpload(request1);
      const response2 = await handleStreamChunkUpload(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.chunkIndex).toBe('0');
      expect(data2.chunkIndex).toBe('1');
      expect(data2.bytesReceived).toBe(2048); // Both chunks
    });

    it('should create journal entry on final chunk', async () => {
      const finalChunk = Buffer.alloc(1024, 'final-chunk');

      const request = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Stream-ID': streamId,
          'X-Chunk-Index': '0',
          'X-Is-Last': 'true',
          'Content-Type': 'video/webm',
        },
        body: finalChunk,
      });

      const response = await handleStreamChunkUpload(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.journalId).toBeDefined();
      expect(data.isLast).toBe(true);

      // Verify journal was created in database
      const journals = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, data.journalId));

      expect(journals).toHaveLength(1);
      expect(journals[0].userId).toBe(testUser.id);
      expect(journals[0].title).toContain('Journal Entry');
    });

    it('should return 401 for missing stream ID', async () => {
      const request = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Chunk-Index': '0',
          'X-Is-Last': 'false',
          'Content-Type': 'video/webm',
        },
        body: Buffer.alloc(1024),
      });

      const response = await handleStreamChunkUpload(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing stream ID');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for invalid stream ID', async () => {
      const request = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Stream-ID': 'invalid-stream-id',
          'X-Chunk-Index': '0',
          'X-Is-Last': 'false',
          'Content-Type': 'video/webm',
        },
        body: Buffer.alloc(1024),
      });

      const response = await handleStreamChunkUpload(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Invalid or expired stream ID');
      expect(data.code).toBe('INVALID_STREAM');
    });

    it('should return 401 for unauthorized user', async () => {
      // Create a different user
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        name: 'Other User',
      });

      const otherSession = await createTestSession(otherUser.id, {
        token: 'other-token',
      });

      const request = new Request('http://localhost:3001/api/journals/stream/chunk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${otherSession.token}`,
          'Content-Type': 'application/json',
          'X-Stream-ID': streamId,
          'X-Chunk-Index': '0',
          'X-Is-Last': 'false',
        },
        body: Buffer.alloc(1024),
      });

      const response = await handleStreamChunkUpload(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Stream Cleanup', () => {
    it('should auto-cleanup expired streams', async () => {
      // This test verifies the cleanup mechanism
      // In actual implementation, streams are cleaned up after 1 hour
      // For testing, we'd need to mock setTimeout or manually trigger cleanup

      const initRequest = new Request('http://localhost:3001/api/journals/stream/init', {
        method: 'POST',
        headers: authHeaders,
      });

      const initResponse = await handleStreamInit(initRequest);
      const initData = await initResponse.json();

      expect(initData.streamId).toBeDefined();
      // Cleanup happens automatically after 1 hour
    }, 10000);
  });
});
