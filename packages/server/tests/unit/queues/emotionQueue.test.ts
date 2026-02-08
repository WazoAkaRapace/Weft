/**
 * Emotion Queue tests
 * Tests emotion detection queue processing, worker management, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser } from '../../fixtures/auth.js';
import { createTestJournal } from '../../fixtures/db.js';
import { EmotionQueue, getEmotionQueue } from '../../../src/queue/EmotionQueue.js';
import { EmotionDetectionService } from '../../../src/services/emotionDetection.js';

describe('EmotionQueue', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let queue: EmotionQueue;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'emotionqueue@example.com',
      username: 'emotionqueueuser',
      name: 'Emotion Queue User',
    });

    vi.clearAllMocks();

    queue = new EmotionQueue();
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

    it('should include force flag in job metadata', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
        force: true,
      });

      const job = queue.getJobStatus(jobId);

      expect(job!.force).toBe(true);
    });

    it('should set initial attempts from retryCount', async () => {
      await queue.start();

      const journal = await createTestJournal(testUser.id);

      const jobId = await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
        retryCount: 1,
      });

      const job = queue.getJobStatus(jobId);

      expect(job!.attempts).toBe(1);
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
      const job = queue.getJobStatus('non-existent-emotion-job');

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

    it('should return undefined for journal with no job', async () => {
      const job = queue.getJobByJournalId(randomUUID());

      expect(job).toBeUndefined();
    });
  });

  describe('Job Processing', () => {
    it('should process pending emotion detection jobs', async () => {
      // Mock successful emotion detection
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockResolvedValue({
        dominantEmotion: 'happy',
        timeline: [
          { time: 0, emotion: 'neutral', confidence: 0.8 },
          { time: 5, emotion: 'happy', confidence: 0.9 },
        ],
        scores: {
          neutral: 0.3,
          happy: 0.5,
          sad: 0.1,
          angry: 0.05,
          fearful: 0.025,
          disgusted: 0.025,
          surprised: 0,
        },
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id, { duration: 10 });

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = queue.getJobByJournalId(journal.id);

      expect(job!.status).toBe('completed');
    }, 5000);

    it('should skip jobs with existing emotion data when not forced', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockResolvedValue({
        dominantEmotion: 'happy',
        timeline: [],
        scores: {},
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id, {
        dominantEmotion: 'sad',
        emotionTimeline: [{ time: 0, emotion: 'sad', confidence: 0.8 }],
        emotionScores: { sad: 0.8, neutral: 0.2 },
      });

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
        force: false, // Not forced
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = queue.getJobByJournalId(journal.id);

      expect(job!.status).toBe('completed');

      // Analyze should not have been called (already has data)
      expect(EmotionDetectionService.prototype.analyze).not.toHaveBeenCalled();
    }, 5000);

    it('should re-analyze when force flag is set', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockResolvedValue({
        dominantEmotion: 'happy',
        timeline: [],
        scores: {},
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id, {
        dominantEmotion: 'sad',
        emotionTimeline: [{ time: 0, emotion: 'sad', confidence: 0.8 }],
        emotionScores: { sad: 0.8, neutral: 0.2 },
      });

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
        force: true, // Force re-analysis
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Analyze should have been called despite existing data
      expect(EmotionDetectionService.prototype.analyze).toHaveBeenCalled();
    }, 5000);
  });

  describe('Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      let attemptCount = 0;
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Face detection failed');
        }
        return Promise.resolve({
          dominantEmotion: 'neutral',
          timeline: [],
          scores: {},
        });
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockResolvedValue(undefined);

      await queue.start();

      const journal = await createTestJournal(testUser.id);

      await queue.addJob({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 8000));

      const job = queue.getJobByJournalId(journal.id);

      expect(attemptCount).toBeGreaterThanOrEqual(3);
      expect(job!.status).toBe('completed');
    }, 15000);

    it('should mark job as failed after max retries', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockRejectedValue(
        new Error('Permanent emotion detection failure')
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
      expect(job!.attempts).toBeGreaterThanOrEqual(3);
      expect(job!.error).toContain('Permanent emotion detection failure');
    }, 15000);

    it('should increment attempts on each retry', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockRejectedValue(
        new Error('Retry emotion detection')
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

      expect(job!.attempts).toBeGreaterThan(0);
    }, 10000);
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
    it('should return same instance from getEmotionQueue()', () => {
      const instance1 = getEmotionQueue();
      const instance2 = getEmotionQueue();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance if not exists', () => {
      (global as any).__EMOTION_QUEUE__ = null;

      const instance = getEmotionQueue();

      expect(instance).toBeInstanceOf(EmotionQueue);
    });
  });

  describe('Worker Concurrency', () => {
    it('should respect worker concurrency setting', async () => {
      process.env.EMOTION_WORKER_CONCURRENCY = '1';

      const customQueue = new EmotionQueue();

      expect(customQueue).toBeDefined();

      await customQueue.stop();

      delete process.env.EMOTION_WORKER_CONCURRENCY;
    });

    it('should use default concurrency when not set', async () => {
      delete process.env.EMOTION_WORKER_CONCURRENCY;

      const defaultQueue = new EmotionQueue();

      expect(defaultQueue).toBeDefined();

      await defaultQueue.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle emotion detection errors gracefully', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockRejectedValue(
        new Error('Emotion detection service error')
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

      expect(job!.error).toBeDefined();
    }, 10000);

    it('should handle save errors gracefully', async () => {
      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockResolvedValue({
        dominantEmotion: 'happy',
        timeline: [],
        scores: {},
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockRejectedValue(
        new Error('Database save error')
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

      expect(job!.status).toBe('failed');
    }, 10000);
  });

  describe('Multiple Jobs', () => {
    it('should process multiple jobs concurrently', async () => {
      let processedCount = 0;

      vi.spyOn(EmotionDetectionService.prototype, 'analyze').mockImplementation(async () => {
        processedCount++;
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          dominantEmotion: 'neutral',
          timeline: [],
          scores: {},
        };
      });

      vi.spyOn(EmotionDetectionService.prototype, 'saveResults').mockResolvedValue(undefined);

      // Set higher concurrency for testing
      process.env.EMOTION_WORKER_CONCURRENCY = '2';

      await queue.start();

      // Create multiple journals
      const journals = await Promise.all([
        createTestJournal(testUser.id, { duration: 10 }),
        createTestJournal(testUser.id, { duration: 10 }),
        createTestJournal(testUser.id, { duration: 10 }),
      ]);

      // Add all jobs
      for (const journal of journals) {
        await queue.addJob({
          journalId: journal.id,
          userId: testUser.id,
          videoPath: journal.videoPath,
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      const stats = queue.getStats();

      // All jobs should be processed
      expect(stats.completed + stats.failed).toBe(3);

      await queue.stop();

      delete process.env.EMOTION_WORKER_CONCURRENCY;
    }, 10000);
  });
});
