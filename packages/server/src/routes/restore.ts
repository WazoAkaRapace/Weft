/**
 * Restore API routes
 *
 * Handles data restore endpoints:
 * - POST /api/restore - Upload and restore a backup archive
 * - GET /api/restore/status/:jobId - Get restore job status
 */

import { auth } from '../lib/auth.js';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Restore strategy for handling conflicts during restore
type RestoreStrategy = 'merge' | 'replace' | 'skip';

// Upload directory configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const RESTORE_TEMP_DIR = path.join(UPLOAD_DIR, 'restore-temp');

// Maximum upload size: 5GB
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024;

/**
 * Ensure restore temp directory exists
 */
async function ensureRestoreTempDir(): Promise<void> {
  if (!existsSync(RESTORE_TEMP_DIR)) {
    await mkdir(RESTORE_TEMP_DIR, { recursive: true });
  }
}

/**
 * BackupRestoreQueue interface
 * This will be implemented by the queue system
 */
export interface BackupRestoreQueue {
  addRestoreJob(job: {
    userId: string;
    archivePath: string;
    strategy: RestoreStrategy;
  }): Promise<string>;
  getJobStatus(jobId: string): {
    id: string;
    type: 'backup' | 'restore';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    userId: string;
    progress: {
      currentStep: string;
      currentStepIndex: number;
      totalSteps: number;
      percentage: number;
      filesProcessed?: number;
      totalFiles?: number;
    };
    error?: string;
    result?: { downloadUrl: string } | {
      journalsRestored: number;
      notesRestored: number;
      filesRestored: number;
      conflictsResolved: number;
    };
  } | undefined;
}

/**
 * Parse multipart/form-data from a Request
 * Extracts file and form fields
 */
async function parseMultipartFormData(request: Request): Promise<{
  file: { data: Buffer; filename: string; mimeType: string };
  fields: Record<string, string>;
}> {
  const contentType = request.headers.get('Content-Type') || '';

  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Invalid content type');
  }

  // Parse boundary from content type
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    throw new Error('No boundary found in content type');
  }

  const boundary = boundaryMatch[1];
  const buffer = Buffer.from(await request.arrayBuffer());

  // Parse multipart data
  const parts: Array<{ name: string; filename?: string; mimeType?: string; data: Buffer }> = [];
  let position = 0;

  while (position < buffer.length) {
    // Find boundary
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const boundaryEnd = Buffer.from(`--${boundary}--`);

    let nextBoundary = -1;
    for (let i = position; i < buffer.length - boundaryBuffer.length; i++) {
      let match = true;
      for (let j = 0; j < boundaryBuffer.length; j++) {
        if (buffer[i + j] !== boundaryBuffer[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        nextBoundary = i;
        break;
      }
    }

    if (nextBoundary === -1) {
      // Check for final boundary
      for (let i = position; i < buffer.length - boundaryEnd.length; i++) {
        let match = true;
        for (let j = 0; j < boundaryEnd.length; j++) {
          if (buffer[i + j] !== boundaryEnd[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          nextBoundary = i;
          break;
        }
      }
    }

    if (nextBoundary <= position) {
      break;
    }

    // Extract part data (between position and nextBoundary)
    const partData = buffer.slice(position, nextBoundary);

    // Parse headers
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      break;
    }

    const headers = partData.slice(0, headerEnd).toString();
    const dataStart = headerEnd + 4;

    // Extract name and filename from headers
    const nameMatch = headers.match(/name="([^"]+)"/i);
    const filenameMatch = headers.match(/filename="([^"]+)"/i);
    const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      const name = nameMatch[1];
      const filename = filenameMatch ? filenameMatch[1] : undefined;
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1].trim() : undefined;

      // Extract data (skip trailing CRLF)
      const dataEnd = partData.length - 2;
      const data = partData.slice(dataStart, dataEnd > dataStart ? dataEnd : dataStart);

      parts.push({
        name,
        filename,
        mimeType,
        data,
      });
    }

    // Move to next boundary
    position = nextBoundary + boundaryBuffer.length;

    // Skip CRLF after boundary
    if (buffer[position] === 0x0d && buffer[position + 1] === 0x0a) {
      position += 2;
    }
  }

  // Separate file and fields
  let filePart: { data: Buffer; filename: string; mimeType: string } | null = null;
  const fields: Record<string, string> = {};

  for (const part of parts) {
    if (part.filename) {
      filePart = {
        data: part.data,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
      };
    } else {
      fields[part.name] = part.data.toString('utf-8');
    }
  }

  if (!filePart) {
    throw new Error('No file found in form data');
  }

  return {
    file: filePart,
    fields,
  };
}

/**
 * Handle restore request
 *
 * POST /api/restore
 *
 * Accepts a multipart/form-data upload with:
 * - archive: The .tar.gz backup archive file
 * - strategy: Restore strategy ('merge', 'replace', or 'skip')
 *
 * @returns Response with jobId or error
 */
export async function handleRestore(request: Request, queue: BackupRestoreQueue): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = session.user.id;

    // Parse multipart form data
    let file: Buffer;
    let filename: string;
    let strategy: RestoreStrategy = 'merge';

    try {
      const parsed = await parseMultipartFormData(request);
      file = parsed.file.data;
      filename = parsed.file.filename;
      strategy = (parsed.fields.strategy as RestoreStrategy) || 'merge';
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to parse multipart form data',
          code: 'INVALID_FORMAT',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate strategy
    if (!['merge', 'replace', 'skip'].includes(strategy)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid restore strategy. Must be one of: merge, replace, skip',
          code: 'INVALID_STRATEGY',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file is .tar.gz
    if (!filename.endsWith('.tar.gz') && !filename.endsWith('.tgz')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file format. Backup archive must be a .tar.gz file',
          code: 'RESTORE_INVALID_FORMAT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.length > MAX_UPLOAD_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / (1024 * 1024 * 1024)}GB`,
          code: 'RESTORE_FILE_TOO_LARGE',
        }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure temp directory exists
    await ensureRestoreTempDir();

    // Save uploaded file to temp directory
    const archiveId = randomUUID();
    const archivePath = path.join(RESTORE_TEMP_DIR, `${archiveId}.tar.gz`);

    const fs = await import('node:fs/promises');
    await fs.writeFile(archivePath, file);

    console.log(`[Restore] Archive saved to ${archivePath} for user ${userId}, strategy: ${strategy}`);

    // Add restore job to queue
    let jobId: string;
    try {
      jobId = await queue.addRestoreJob({
        userId,
        archivePath,
        strategy,
      });
    } catch (error) {
      // Clean up temp file if queue fails
      await unlink(archivePath).catch(() => {});
      throw error;
    }

    console.log(`[Restore] Job ${jobId} queued for restore`);

    return new Response(
      JSON.stringify({
        jobId,
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Restore] Restore request error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle get restore status request
 *
 * GET /api/restore/status/:jobId
 *
 * Returns the current status of a restore job.
 *
 * @returns Response with job status or error
 */
export async function handleGetRestoreStatus(request: Request, queue: BackupRestoreQueue): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = session.user.id;

    // Extract jobId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return new Response(
        JSON.stringify({
          error: 'Missing job ID',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get job status
    const job = queue.getJobStatus(jobId);

    if (!job) {
      return new Response(
        JSON.stringify({
          error: 'Job not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify job belongs to user
    if (job.userId !== userId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify job is a restore job
    if (job.type !== 'restore') {
      return new Response(
        JSON.stringify({
          error: 'Invalid job type',
          code: 'INVALID_JOB_TYPE',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        result: job.result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Restore] Get status error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
