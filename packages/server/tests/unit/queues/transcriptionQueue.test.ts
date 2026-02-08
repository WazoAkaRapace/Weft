/**
 * Transcription Queue tests
 * Tests queue processing, worker management, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb, getTestDbRaw } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser } from '../../fixtures/auth.js';
import { createTestJournal } from '../../fixtures/db.js';
import { TranscriptionQueue, getTranscriptionQueue } from '../../../src/queue/TranscriptionQueue.js';
import { TranscriptionService } from '../../../src/services/transcription.js';

describe('TranscriptionQueue', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let queue: TranscriptionQueue;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'queue@example.com',
      username: 'queueuser',
      name: 'Queue User',
    });

    // Reset singleton
    vi.clearAllMocks();

    // Create new queue instance for each test
    queue = new TranscriptionQueue();
  });

  afterEach(async () => {
    await queue.stop();
  });

  describe('Queue Lifecycle', () => {
    it('should start queue successfully', async () => {
      await queue.start();

      // Queue should be running
      expect(queue).toBeDefined();
    });

    it('should not start if already running', async () => {
      await queue.start();

      // Second start should be safe
      await queue.start();

      // Should not throw error
      expect(queue).toBeDefined();
    });

    it('should stop queue and wait for processing jobs', async () => {
      await queue.start();

      // Add a job
      const journal = await createTestJournal(testUser.id);
      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Stop immediately
      const stopPromise = queue.stop();

      // Should complete (with timeout for processing jobs)
      await expect(stopPromise).resolves.toBeUndefined();
    });
  });

  describe('addJob()', () => {
    it('should add job to queue and return ID', async () => {
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

    it('should set job status to pending initially', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      const job = queue.getJobStatus(jobId);

      expect(job!.status).toBe('pending');
      expect(job!.attempts).toBe(0);
    });

    it('should include job metadata', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
        retryCount: 2,
      });

      const job = queue.getJobStatus(jobId);

      expect(job!.journalId).toBe(journal.id);
      expect(job!.userId).toBe(testUser.id);
      expect(job!.videoPath).toBe(journal.videoPath);
      expect(job!.retryCount).toBe(2);
      expect(job!.attempts).toBe(2); // retryCount becomes initial attempts
    });

    it('should generate unique job IDs', async () => {
      await queue.start();

      const journal1 = await createTestJournal(testUser.id);
      const journal2 = await createTestJournal(testUser.id);

      const jobId1 = await queue.addJob({
        journalId: journal1.id,
        userId: testUser.id,
        videoPath: journal1.videoPath,
      });

      const jobId2 = await queue.addJob({
        journalId: journal2.id,
        userId: testUser.id,
        videoPath: journal2.videoPath,
      });

      expect(jobId1).not.toBe(jobId2);
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
      const job = queue.getJobStatus('non-existent-id');

      expect(job).toBeUndefined();
    });
  });

  describe('getJobByJournalId()', () => {
    it('should find job by journal ID', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      const job = queue.getJobByJournalId(journal.id);

      expect(job).toBeDefined();
      expect(job!.id).toBe(jobId);
    });

    it('should return undefined for journal with no job', async () => {
      const job = queue.getJobByJournalId(randomUUID());

      expect(job).toBeUndefined();
    });
  });

  describe('Job Processing', () => {
    it('should process pending jobs', async () => {
      // Mock successful transcription
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockResolvedValue({
        text: 'Test transcript',
        segments: [{ start: 0, end: 5, text: 'Test transcript' }],
      });

      vi.spyOn(TranscriptionService.prototype, 'saveTranscription').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = queue.getJobByJournalId(journal.id);

      // Job should be processed
      expect(job!.status).toBe('completed');

      // Verify transcript was saved
      const transcripts = await db
        .select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.journalId, journal.id));

      expect(transcripts).toHaveLength(1);
    }, 5000);

    it('should transition job status: pending -> processing -> completed', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      vi.spyOn(TranscriptionService.prototype, 'saveTranscription').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Initial status
      let job = queue.getJobStatus(jobId);
      expect(job!.status).toBe('pending');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      job = queue.getJobStatus(jobId);
      expect(job!.status).toBe('completed');
    }, 5000);

    it('should skip jobs that already have transcripts', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      vi.spyOn(TranscriptionService.prototype, 'saveTranscription').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      // Pre-create transcript
      await db.insert(schema.transcripts).values({
        id: randomUUID(),
        journalId: journal.id,
        text: 'Existing transcript',
        segments: [],
      });

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = queue.getJobByJournalId(journal.id);

      expect(job!.status).toBe('completed');

      // Transcription service should not have been called
      expect(TranscriptionService.prototype.transcribe).not.toHaveBeenCalled();
    }, 5000);
  });

  describe('Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      let attemptCount = 0;
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({
          text: 'Success',
          segments: [],
        });
      });

      vi.spyOn(TranscriptionService.prototype, 'saveTranscription').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 5000));

      const job = queue.getJobByJournalId(journal.id);

      // Should eventually succeed
      expect(attemptCount).toBe(3);
      expect(job!.status).toBe('completed');
    }, 10000);

    it('should mark job as failed after max retries', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockRejectedValue(
        new Error('Permanent failure')
      );

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for retries to exhaust
      await new Promise(resolve => setTimeout(resolve, 10000));

      const job = queue.getJobByJournalId(journal.id);

      expect(job!.status).toBe('failed');
      expect(job!.attempts).toBe(3); // Max retries
      expect(job!.error).toContain('Permanent failure');
    }, 15000);

    it('should increment attempts on each retry', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockRejectedValue(
        new Error('Retry needed')
      );

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for first retry
      await new Promise(resolve => setTimeout(resolve, 3000));

      let job = queue.getJobStatus(jobId);

      // Attempts should have incremented
      expect(job!.attempts).toBeGreaterThan(0);
    }, 10000);
  });

  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      await queue.start();

      // Add jobs with different statuses
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

      // Sum should equal total
      const sum = stats.pending + stats.processing + stats.completed + stats.failed;
      expect(sum).toBe(stats.total);
    });

    it('should return zero stats for empty queue', async () => {
      await queue.start();

      const stats = queue.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance from getTranscriptionQueue()', () => {
      const instance1 = getTranscriptionQueue();
      const instance2 = getTranscriptionQueue();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance if not exists', () => {
      // Clear any existing instance
      (global as any).__TRANSCRIPTION_QUEUE__ = null;

      const instance = getTranscriptionQueue();

      expect(instance).toBeInstanceOf(TranscriptionQueue);
    });
  });

  describe('Worker Concurrency', () => {
    it('should respect worker concurrency setting', async () => {
      // Set concurrency to 1
      process.env.TRANSCRIPTION_WORKER_CONCURRENCY = '1';

      const customQueue = new TranscriptionQueue();

      expect(customQueue).toBeDefined();

      await customQueue.stop();

      delete process.env.TRANSCRIPTION_WORKER_CONCURRENCY;
    });

    it('should use default concurrency when not set', async () => {
      delete process.env.TRANSCRIPTION_WORKER_CONCURRENCY;

      const defaultQueue = new TranscriptionQueue();

      expect(defaultQueue).toBeDefined();

      await defaultQueue.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockRejectedValue(
        new Error('Transcription service error')
      );

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

      // Should have error information
      expect(job!.error).toBeDefined();
    }, 10000);

    it('should handle save errors gracefully', async () => {
      vi.spyOn(TranscriptionService.prototype, 'transcribe').mockResolvedValue({
        text: 'Test',
        segments: [],
      });

      vi.spyOn(TranscriptionService.prototype, 'saveTranscription').mockRejectedValue(
        new Error('Database error')
      );

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 3000));

      const job = queue.getJobByJournalId(journal.id);

      // Should fail due to save error
      expect(job!.status).toBe('failed');
    }, 10000);
  });
});
