/**
 * Emotion Detection Queue
 * Simple in-memory queue with worker pool for background emotion processing
 * Voice-only emotion detection using SpeechBrain
 */

import { EmotionDetectionService, type EmotionJob } from '../services/unifiedEmotionDetection.js';

export interface QueuedJob extends EmotionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export class EmotionQueue {
  private queue: Map<string, QueuedJob> = new Map();
  private processing: Set<string> = new Set();
  private service: EmotionDetectionService;
  private workerCount: number;
  private pollInterval: number;
  private isRunning: boolean = false;
  private workers: Array<ReturnType<typeof setTimeout>> = [];

  constructor() {
    this.service = new EmotionDetectionService();
    this.workerCount = parseInt(
      process.env.EMOTION_WORKER_CONCURRENCY || '2',
      10
    );
    this.pollInterval = 1000; // 1 second
  }

  /**
   * Start the queue and workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[EmotionQueue] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[EmotionQueue] Starting with ${this.workerCount} workers`);

    // Start worker processes
    for (let i = 0; i < this.workerCount; i++) {
      this.startWorker(i);
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: EmotionJob): Promise<string> {
    const jobId = `${job.journalId}-emotion-${Date.now()}`;

    const queuedJob: QueuedJob = {
      id: jobId,
      ...job,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };

    this.queue.set(jobId, queuedJob);
    console.log(`[EmotionQueue] Job ${jobId} added for journal ${job.journalId}`);

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): QueuedJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get job by journal ID
   */
  getJobByJournalId(journalId: string): QueuedJob | undefined {
    for (const job of this.queue.values()) {
      if (job.journalId === journalId) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Worker process that polls and processes jobs
   */
  private startWorker(workerId: number): void {
    console.log(`[EmotionQueue] Worker ${workerId} started`);

    const poll = async () => {
      if (!this.isRunning) return;

      try {
        // Find next pending job
        const job = this.findNextPendingJob();

        if (job) {
          await this.processJob(job, workerId);
        }
      } catch (error) {
        console.error(`[EmotionQueue] Worker ${workerId} error:`, error);
      }

      // Schedule next poll
      const timeoutId = setTimeout(poll, this.pollInterval);
      this.workers.push(timeoutId);
    };

    // Start polling
    poll();
  }

  /**
   * Find next pending job (not currently being processed)
   */
  private findNextPendingJob(): QueuedJob | undefined {
    for (const job of this.queue.values()) {
      if (job.status === 'pending' && !this.processing.has(job.id)) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueuedJob, workerId: number): Promise<void> {
    // Mark as processing
    this.processing.add(job.id);
    job.status = 'processing';
    job.processedAt = new Date();

    console.log(`[EmotionQueue] Worker ${workerId} processing job ${job.id}`);

    try {
      // Validate journal exists
      const exists = await this.service.validateJournal(job.journalId);
      if (!exists) {
        throw new Error(`Journal ${job.journalId} not found`);
      }

      // Check if already analyzed (skip if force flag is set)
      if (!job.force) {
        const existing = await this.service.getResults(job.journalId);
        if (existing?.dominantEmotion) {
          console.log(`[EmotionQueue] Job ${job.id} already has emotion data, skipping`);
          job.status = 'completed';
          return;
        }
      } else {
        console.log(`[EmotionQueue] Job ${job.id} forcing emotion regeneration`);
      }

      // Perform emotion detection
      const result = await this.service.analyze(job);

      // Save to database
      await this.service.saveResults(job.journalId, result);

      // Mark as completed
      job.status = 'completed';
      console.log(`[EmotionQueue] Worker ${workerId} completed job ${job.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[EmotionQueue] Worker ${workerId} failed job ${job.id}:`, errorMessage);

      // Handle retries
      const maxRetries = parseInt(process.env.EMOTION_MAX_RETRIES || '3', 10);

      if (job.attempts < maxRetries) {
        // Retry later
        job.status = 'pending';
        job.attempts++;
        job.error = errorMessage;

        // Calculate exponential backoff delay
        const delay = Math.min(Math.pow(2, job.attempts) * 1000, 60000); // Max 60 seconds

        setTimeout(() => {
          this.processing.delete(job.id);
        }, delay);

        console.log(`[EmotionQueue] Job ${job.id} will retry in ${delay}ms (attempt ${job.attempts}/${maxRetries})`);
        return;
      } else {
        // Max retries reached
        job.status = 'failed';
        job.error = errorMessage;
        console.error(`[EmotionQueue] Job ${job.id} failed after ${maxRetries} attempts`);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Stop the queue and workers
   */
  async stop(): Promise<void> {
    console.log('[EmotionQueue] Stopping...');
    this.isRunning = false;

    // Clear all worker timers
    for (const timeoutId of this.workers) {
      clearTimeout(timeoutId);
    }
    this.workers = [];

    // Wait for processing jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.processing.size > 0 && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.processing.size > 0) {
      console.warn(`[EmotionQueue] ${this.processing.size} jobs still processing during shutdown`);
    }

    console.log('[EmotionQueue] Stopped');
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const jobs = Array.from(this.queue.values());

    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    };
  }
}

// Singleton instance
let queueInstance: EmotionQueue | null = null;

export function getEmotionQueue(): EmotionQueue {
  if (!queueInstance) {
    queueInstance = new EmotionQueue();
  }
  return queueInstance;
}
