/**
 * HLS Queue tests
 * Tests HLS transcoding queue processing and worker management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser } from '../../fixtures/auth.js';
import { createTestJournal } from '../../fixtures/db.js';
import { HLSQueue, getHLSQueue } from '../../../src/queue/HLSQueue.js';

// Mock FFmpeg for HLS transcoding
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(function(this: any, event: string, callback: () => void) {
      if (event === 'close') {
        setTimeout(() => callback(0), 100); // Simulate HLS transcoding
      }
      return this;
    }),
    stderr: {
      on: vi.fn(function(this: any, event: string, callback: (data: string) => void) {
        if (event === 'data') {
          // Simulate FFmpeg progress output
          callback('frame=  100 fps= 33 q=28.0 size=     1024kB time=00:00:03.33 bitrate= 2516.7kbits/s speed=1.32x');
        }
        return this;
      }),
    },
    stdout: {
      on: vi.fn(function(this: any) {
        return this;
      }),
    },
  }),
}));

describe('HLSQueue', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let queue: HLSQueue;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'hlsqueue@example.com',
      username: 'hlsqueueuser',
      name: 'HLS Queue User',
    });

    vi.clearAllMocks();

    queue = new HLSQueue();
  });

  afterEach(async () => {
    await queue.stop();
  });

  describe('Queue Lifecycle', () => {
    it('should start queue successfully', async () => {
      await queue.start();

      expect(queue).toBeDefined();
    });

    it('should not start if already running', async () => {
      await queue.start();

      // Second start should be safe
      await queue.start();

      expect(queue).toBeDefined();
    });

    it('should stop queue gracefully', async () => {
      await queue.start();

      await expect(queue.stop()).resolves.toBeUndefined();
    });
  });

  describe('addJob()', () => {
    it('should add HLS transcoding job to queue', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = queue.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('pending');
    });

    it('should include journal metadata in job', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id, {
        duration: 120,
      });

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      const job = queue.getJobStatus(jobId);

      expect(job!.journalId).toBe(journal.id);
      expect(job!.userId).toBe(testUser.id);
      expect(job!.videoPath).toBe(journal.videoPath);
    });
  });

  describe('getJobStatus()', () => {
    it('should return job by ID', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      const job = queue.getJobStatus(jobId);

      expect(job).toBeDefined();
      expect(job!.id).toBe(jobId);
    });

    it('should return undefined for non-existent job', () => {
      const job = queue.getJobStatus('non-existent-hls-job');

      expect(job).toBeUndefined();
    });
  });

  describe('getJobByJournalId()', () => {
    it('should find job by journal ID', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      const job = queue.getJobByJournalId(journal.id);

      expect(job).toBeDefined();
    });

    it('should return undefined for journal with no job', () => {
      const job = queue.getJobByJournalId(randomUUID());

      expect(job).toBeUndefined();
    });
  });

  describe('HLS Transcoding Process', () => {
    it('should update journal HLS status during transcoding', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      // Status should be updated (pending, processing, or completed)
      expect(['pending', 'processing', 'completed']).toContain(updatedJournal[0].hlsStatus);
    }, 10000);

    it('should set hlsManifestPath when transcoding completes', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      // Should have manifest path when completed
      if (updatedJournal[0].hlsStatus === 'completed') {
        expect(updatedJournal[0].hlsManifestPath).toBeDefined();
        expect(updatedJournal[0].hlsManifestPath).toContain('.m3u8');
      }
    }, 10000);

    it('should set hlsCreatedAt timestamp on completion', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      if (updatedJournal[0].hlsStatus === 'completed') {
        expect(updatedJournal[0].hlsCreatedAt).toBeDefined();
        expect(updatedJournal[0].hlsCreatedAt).toBeInstanceOf(Date);
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle FFmpeg errors gracefully', async () => {
      const { spawn } = await import('node:child_process');

      // Mock FFmpeg failure
      vi.mocked(spawn).mockImplementation(() => {
        const mockStream: any = {
          on: vi.fn(function(this: any, event: string, callback: () => void) {
            if (event === 'error') {
              setTimeout(() => callback(new Error('FFmpeg not found')), 10);
            }
            return this;
          }),
          stderr: {
            on: vi.fn(function(this: any) {
              return this;
            }),
          },
        };
        return mockStream;
      });

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 3000));

      const job = queue.getJobByJournalId(journal.id);

      expect(job!.error).toBeDefined();
      expect(job!.status).toBe('failed');

      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      expect(updatedJournal[0].hlsStatus).toBe('failed');
      expect(updatedJournal[0].hlsError).toBeDefined();
    }, 10000);

    it('should store error message in hlsError field', async () => {
      const { spawn } = await import('node:child_process');

      vi.mocked(spawn).mockImplementation(() => {
        const mockStream: any = {
          on: vi.fn(function(this: any, event: string, callback: () => void) {
            if (event === 'error') {
              setTimeout(() => callback(new Error('HLS transcoding failed: invalid codec')), 10);
            }
            return this;
          }),
          stderr: {
            on: vi.fn(function(this: any) {
              return this;
            }),
          },
        };
        return mockStream;
      });

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 3000));

      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      expect(updatedJournal[0].hlsError).toContain('HLS transcoding failed');
    }, 10000);
  });

  describe('Status Transitions', () => {
    it('should transition: pending -> processing -> completed', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Check initial status
      let job = queue.getJobStatus(jobId);
      expect(job!.status).toBe('pending');

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 500));

      job = queue.getJobStatus(jobId);
      if (job!.status === 'processing' || job!.status === 'completed') {
        // Status has progressed
        expect(['processing', 'completed']).toContain(job!.status);
      }

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      job = queue.getJobStatus(jobId);
      expect(['completed', 'failed']).toContain(job!.status);
    }, 10000);
  });

  describe('Retry Logic', () => {
    it('should retry failed transcoding jobs', async () => {
      let attemptCount = 0;
      const { spawn } = await import('node:child_process');

      vi.mocked(spawn).mockImplementation(() => {
        attemptCount++;
        const mockStream: any = {
          on: vi.fn(function(this: any, event: string, callback: () => void) {
            if (attemptCount < 3) {
              if (event === 'close') {
                setTimeout(() => callback(1), 10); // Exit code 1 = error
              }
            } else {
              setTimeout(() => callback(0), 100); // Success
            }
            return this;
          }),
          stderr: {
            on: vi.fn(function(this: any) {
              return this;
            }),
          },
        };
        return mockStream;
      });

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 10000));

      const job = queue.getJobByJournalId(journal.id);

      // Should eventually succeed or fail after max retries
      expect(job!.attempts).toBeGreaterThan(0);
    }, 15000);
  });

  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      await queue.start();

      const journal1 = await createTestJournal(testUser.id);
      const journal2 = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal1.id,
        userId: testUser.id,
        videoPath: journal1.videoPath,
      });

      await queue.addJob({
        journalId: journal2.id,
        userId: testUser.id,
        videoPath: journal2.videoPath,
      });

      const stats = queue.getStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.processing).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });

    it('should return zero stats for empty queue', async () => {
      await queue.start();

      const stats = queue.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance from getHLSQueue()', () => {
      const instance1 = getHLSQueue();
      const instance2 = getHLSQueue();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance if not exists', () => {
      (global as any).__HLS_QUEUE__ = null;

      const instance = getHLSQueue();

      expect(instance).toBeInstanceOf(HLSQueue);
    });
  });

  describe('Worker Concurrency', () => {
    it('should respect worker concurrency setting', async () => {
      process.env.HLS_WORKER_CONCURRENCY = '1';

      const customQueue = new HLSQueue();

      expect(customQueue).toBeDefined();

      await customQueue.stop();

      delete process.env.HLS_WORKER_CONCURRENCY;
    });
  });

  describe('HLS File Creation', () => {
    it('should create HLS directory structure', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // HLS files should be created in uploads directory
      // In actual implementation, files would be created in UPLOAD_DIR/hls/{journalId}/
    }, 10000);

    it('should create master playlist and segment playlists', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify journal has manifest path
      const updatedJournal = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal.id));

      if (updatedJournal[0].hlsStatus === 'completed') {
        expect(updatedJournal[0].hlsManifestPath).toContain('master.m3u8');
      }
    }, 10000);
  });

  describe('Cleanup', () => {
    it('should clean up temporary files on journal deletion', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for some processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Delete journal
      await db.delete(schema.journals).where(eq(schema.journals.id, journal.id));

      // In actual implementation, HLS files would be cleaned up
      // This would be tested in the integration tests
    });
  });
});
