/**
 * HLS Transcoding Queue
 * Simple in-memory queue with worker pool for background HLS transcoding
 */

import { transcodeToHLS, getHLSStatus } from '../lib/hls.js';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface HLSJob {
  journalId: string;
  userId: string;
  videoPath: string;
  retryCount?: number;
}

export interface QueuedHLSJob extends HLSJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export class HLSQueue {
  private queue: Map<string, QueuedHLSJob> = new Map();
  private processing: Set<string> = new Set();
  private workerCount: number;
  private pollInterval: number;
  private isRunning: boolean = false;
  private workers: Array<ReturnType<typeof setInterval>> = [];

  constructor() {
    this.workerCount = parseInt(
      process.env.HLS_WORKER_CONCURRENCY || '1',
      10
    );
    this.pollInterval = 2000; // 2 seconds (HLS transcoding is CPU intensive)
  }

  /**
   * Start the queue and workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[HLSQueue] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[HLSQueue] Starting with ${this.workerCount} workers`);

    // Start worker processes
    for (let i = 0; i < this.workerCount; i++) {
      this.startWorker(i);
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: HLSJob): Promise<string> {
    const jobId = `${job.journalId}-${Date.now()}`;

    // Check if HLS transcoding is already complete
    const hlsStatus = await getHLSStatus(job.videoPath);
    if (hlsStatus.isComplete) {
      console.log(`[HLSQueue] HLS already transcoded for journal ${job.journalId}, skipping queue`);
      await this.updateJournalHLSStatus(job.journalId, 'completed', hlsStatus.masterPlaylistPath);
      return jobId;
    }

    const queuedJob: QueuedHLSJob = {
      id: jobId,
      ...job,
      status: 'pending',
      attempts: job.retryCount || 0,
      createdAt: new Date(),
    };

    this.queue.set(jobId, queuedJob);
    console.log(`[HLSQueue] Job ${jobId} added for journal ${job.journalId}`);

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): QueuedHLSJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get job by journal ID
   */
  getJobByJournalId(journalId: string): QueuedHLSJob | undefined {
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
    console.log(`[HLSQueue] Worker ${workerId} started`);

    const poll = async () => {
      if (!this.isRunning) return;

      try {
        // Find next pending job
        const job = this.findNextPendingJob();

        if (job) {
          await this.processJob(job, workerId);
        }
      } catch (error) {
        console.error(`[HLSQueue] Worker ${workerId} error:`, error);
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
  private findNextPendingJob(): QueuedHLSJob | undefined {
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
  private async processJob(job: QueuedHLSJob, workerId: number): Promise<void> {
    // Mark as processing
    this.processing.add(job.id);
    job.status = 'processing';
    job.processedAt = new Date();

    console.log(`[HLSQueue] Worker ${workerId} processing job ${job.id}`);

    try {
      // Validate journal exists
      const journal = await this.validateJournal(job.journalId);
      if (!journal) {
        throw new Error(`Journal ${job.journalId} not found`);
      }

      // Check if HLS is already complete in database
      if (journal.hlsStatus === 'completed' && journal.hlsManifestPath) {
        console.log(`[HLSQueue] Job ${job.id} already has HLS, skipping`);
        job.status = 'completed';
        return;
      }

      // Update database status to processing
      await this.updateJournalHLSStatus(job.journalId, 'processing');

      // Perform HLS transcoding
      const manifestPath = await transcodeToHLS(job.videoPath);

      // Update database with success
      await this.updateJournalHLSStatus(job.journalId, 'completed', manifestPath);

      // Mark as completed
      job.status = 'completed';
      console.log(`[HLSQueue] Worker ${workerId} completed job ${job.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[HLSQueue] Worker ${workerId} failed job ${job.id}:`, errorMessage);

      // Handle retries
      const maxRetries = parseInt(process.env.HLS_MAX_RETRIES || '2', 10);

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

        console.log(`[HLSQueue] Job ${job.id} will retry in ${delay}ms (attempt ${job.attempts}/${maxRetries})`);

        // Update database with retry status
        await this.updateJournalHLSStatus(job.journalId, 'pending', undefined, errorMessage);
        return;
      } else {
        // Max retries reached
        job.status = 'failed';
        job.error = errorMessage;
        console.error(`[HLSQueue] Job ${job.id} failed after ${maxRetries} attempts`);

        // Update database with failed status
        await this.updateJournalHLSStatus(job.journalId, 'failed', undefined, errorMessage);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Validate that a journal exists and return the full journal with HLS status
   */
  private async validateJournal(journalId: string): Promise<{
    id: string;
    hlsStatus?: string | null;
    hlsManifestPath?: string | null;
  } | null> {
    const result = await db
      .select({
        id: journals.id,
        hlsStatus: journals.hlsStatus,
        hlsManifestPath: journals.hlsManifestPath,
      })
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update journal HLS status in database
   */
  private async updateJournalHLSStatus(
    journalId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    manifestPath?: string,
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      hlsStatus: status,
    };

    if (manifestPath) {
      updateData.hlsManifestPath = manifestPath;
      updateData.hlsCreatedAt = new Date();
      updateData.hlsError = null;
    }

    if (error) {
      updateData.hlsError = error;
    }

    if (status === 'completed') {
      updateData.hlsError = null;
    }

    await db
      .update(journals)
      .set(updateData)
      .where(eq(journals.id, journalId));
  }

  /**
   * Stop the queue and workers
   */
  async stop(): Promise<void> {
    console.log('[HLSQueue] Stopping...');
    this.isRunning = false;

    // Clear all worker timers
    for (const timeoutId of this.workers) {
      clearTimeout(timeoutId);
    }
    this.workers = [];

    // Wait for processing jobs to complete (with timeout)
    const timeout = 60000; // 60 seconds (HLS jobs take longer)
    const start = Date.now();

    while (this.processing.size > 0 && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.processing.size > 0) {
      console.warn(`[HLSQueue] ${this.processing.size} jobs still processing during shutdown`);
    }

    console.log('[HLSQueue] Stopped');
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
let queueInstance: HLSQueue | null = null;

export function getHLSQueue(): HLSQueue {
  if (!queueInstance) {
    queueInstance = new HLSQueue();
  }
  return queueInstance;
}
