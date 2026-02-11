/**
 * Backup API routes
 *
 * Handles backup creation and download endpoints:
 * - POST /api/backup/create - Create a new backup job
 * - GET /api/backup/status/:jobId - Get backup job status
 * - GET /api/backup/download/:jobId - Download completed backup archive
 */

import { auth } from '../lib/auth.js';
import { type BackupRestoreQueue } from '../queue/BackupRestoreQueue.js';
import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';

/**
 * Upload directory configuration
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

/**
 * Error codes
 */
const ERROR_CODES = {
  BACKUP_INVALID_SESSION: 'BACKUP_INVALID_SESSION',
  BACKUP_JOB_NOT_FOUND: 'BACKUP_JOB_NOT_FOUND',
  BACKUP_INVALID_REQUEST: 'BACKUP_INVALID_REQUEST',
  BACKUP_FILE_NOT_FOUND: 'BACKUP_FILE_NOT_FOUND',
} as const;

/**
 * Handle backup creation request
 *
 * POST /api/backup/create
 *
 * Creates a new backup job and returns the job ID for tracking.
 *
 * @param request - The incoming HTTP request
 * @param queue - The BackupRestoreQueue instance
 * @returns Response with jobId or error
 */
export async function handleCreateBackup(
  request: Request,
  queue: BackupRestoreQueue
): Promise<Response> {
  try {
    // Verify authentication using BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: ERROR_CODES.BACKUP_INVALID_SESSION,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = session.user.id;

    // Add backup job to queue
    const jobId = await queue.addBackupJob({ userId });

    return new Response(
      JSON.stringify({
        jobId,
        message: 'Backup job created successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Backup create error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to create backup job',
        code: 'BACKUP_CREATE_ERROR',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle backup status request
 *
 * GET /api/backup/status/:jobId
 *
 * Returns the current status and progress of a backup job.
 *
 * @param request - The incoming HTTP request
 * @param jobId - The job ID to check status for
 * @param queue - The BackupRestoreQueue instance
 * @returns Response with job status or error
 */
export async function handleGetBackupStatus(
  request: Request,
  jobId: string,
  queue: BackupRestoreQueue
): Promise<Response> {
  try {
    // Verify authentication using BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: ERROR_CODES.BACKUP_INVALID_SESSION,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get job from queue
    const job = queue.getJob(jobId);

    if (!job) {
      return new Response(
        JSON.stringify({
          error: 'Backup job not found',
          code: ERROR_CODES.BACKUP_JOB_NOT_FOUND,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify job belongs to user
    if (job.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: ERROR_CODES.BACKUP_INVALID_SESSION,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        type: job.type,
        status: job.status,
        progress: {
          currentStep: job.progress.currentStep,
          currentStepIndex: job.progress.currentStepIndex,
          totalSteps: job.progress.totalSteps,
          percentage: job.progress.percentage,
        },
        error: job.error,
        result: job.result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Backup status error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to get backup status',
        code: 'BACKUP_STATUS_ERROR',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle backup download request
 *
 * GET /api/backup/download/:jobId
 *
 * Streams the completed backup archive file as an attachment.
 *
 * @param request - The incoming HTTP request
 * @param jobId - The job ID to download backup for
 * @param queue - The BackupRestoreQueue instance
 * @returns Response with backup file stream or error
 */
export async function handleDownloadBackup(
  request: Request,
  jobId: string,
  queue: BackupRestoreQueue
): Promise<Response> {
  try {
    // Verify authentication using BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: ERROR_CODES.BACKUP_INVALID_SESSION,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get job from queue
    const job = queue.getJob(jobId);

    if (!job) {
      return new Response(
        JSON.stringify({
          error: 'Backup job not found',
          code: ERROR_CODES.BACKUP_JOB_NOT_FOUND,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify job belongs to user
    if (job.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: ERROR_CODES.BACKUP_INVALID_SESSION,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: 'Backup is not ready for download',
          code: ERROR_CODES.BACKUP_INVALID_REQUEST,
          status: job.status,
          progress: {
            currentStep: job.progress.currentStep,
            percentage: job.progress.percentage,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the archive path from job result
    const archivePath =
      job.result && 'downloadUrl' in job.result ? job.result.downloadUrl : undefined;

    if (!archivePath) {
      return new Response(
        JSON.stringify({
          error: 'Backup file path not found',
          code: ERROR_CODES.BACKUP_FILE_NOT_FOUND,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if file exists
    const fullPath = archivePath.startsWith('/') ? archivePath : join(UPLOAD_DIR, archivePath);
    if (!existsSync(fullPath)) {
      return new Response(
        JSON.stringify({
          error: 'Backup file not found on server',
          code: ERROR_CODES.BACKUP_FILE_NOT_FOUND,
          path: fullPath,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a ReadableStream from the file
    const fileStream = createReadStream(fullPath);
    const nodeStream = await import('node:stream');
    const webStream = nodeStream.Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

    // Generate filename based on userId and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `weft-backup-${timestamp}-${session.user.id}.tar.gz`;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Prevent proxies from compressing or modifying the response
        'Cache-Control': 'no-cache, no-transform',
        'Content-Encoding': 'identity',  // Tell proxies not to encode
      },
    });
  } catch (error) {
    console.error('Backup download error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to download backup',
        code: 'BACKUP_DOWNLOAD_ERROR',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
