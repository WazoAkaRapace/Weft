/**
 * Journal streaming API routes
 *
 * Handles video streaming endpoints for journal creation:
 * - POST /api/journals/stream/init - Initialize a new stream
 * - POST /api/journals/stream - Upload stream data
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';

// Upload directory configuration
const UPLOAD_DIR = '/app/uploads';
const TEMP_DIR = path.join(UPLOAD_DIR, 'temp');

/**
 * Ensure upload directories exist
 */
async function ensureUploadDirs(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

/**
 * Active stream tracking
 */
interface ActiveStream {
  userId: string;
  streamId: string;
  bytesReceived: number;
  startTime: number;
  tempFilePath: string;
}

const activeStreams = new Map<string, ActiveStream>();

/**
 * Initialize a new video stream
 *
 * POST /api/journals/stream/init
 *
 * Validates authentication and creates a new stream session.
 *
 * @returns Response with streamId or error
 */
export async function handleStreamInit(request: Request): Promise<Response> {
  try {
    // Verify authentication using BetterAuth
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

    const streamId = randomUUID();
    const userId = session.user.id;

    // Create temporary file for stream
    await ensureUploadDirs();
    const tempFilePath = path.join(TEMP_DIR, `${streamId}.tmp`);

    // Track active stream
    activeStreams.set(streamId, {
      userId,
      streamId,
      bytesReceived: 0,
      startTime: Date.now(),
      tempFilePath,
    });

    // Set up auto-cleanup after 1 hour
    setTimeout(() => {
      const stream = activeStreams.get(streamId);
      if (stream) {
        activeStreams.delete(streamId);
        // Clean up temp file if it exists
        if (existsSync(stream.tempFilePath)) {
          unlink(stream.tempFilePath).catch(() => {
            // Ignore cleanup errors
          });
        }
      }
    }, 60 * 60 * 1000); // 1 hour

    return new Response(
      JSON.stringify({
        streamId,
        uploadUrl: '/api/journals/stream',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stream init error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle streaming video upload
 *
 * POST /api/journals/stream
 *
 * Accepts streaming video data and creates a journal entry.
 *
 * Headers:
 * - X-Stream-ID: Stream identifier from init
 * - Content-Type: Video MIME type
 *
 * @returns Response with journal entry details or error
 */
export async function handleStreamUpload(request: Request): Promise<Response> {
  const streamId = request.headers.get('X-Stream-ID');
  const contentType = request.headers.get('Content-Type') || 'video/webm';

  if (!streamId) {
    return new Response(
      JSON.stringify({
        error: 'Missing stream ID',
        code: 'VALIDATION_ERROR',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const streamData = activeStreams.get(streamId);

  if (!streamData) {
    return new Response(
      JSON.stringify({
        error: 'Invalid or expired stream ID',
        code: 'INVALID_STREAM',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify session ownership
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user || session.user.id !== streamData.userId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine file extension from content type
    const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
    const finalFileName = `${streamId}.${ext}`;
    const finalFilePath = path.join(UPLOAD_DIR, finalFileName);

    // Convert Web Streams API to Node.js ReadableStream
    if (!request.body) {
      return new Response(
        JSON.stringify({
          error: 'No request body',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use Bun.file() to handle the stream efficiently
    const fileWriter = Bun.file(finalFilePath).writer();
    const reader = request.body.getReader();
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Write chunk directly to file
        await fileWriter.write(value);
        totalBytes += value.length;
        streamData.bytesReceived = totalBytes;
      }
    } finally {
      await fileWriter.end();
    }

    // Calculate duration from timing
    const duration = Math.max(1, Math.round((Date.now() - streamData.startTime) / 1000));

    // Create journal entry
    const journalId = randomUUID();
    await db.insert(journals).values({
      id: journalId,
      userId: streamData.userId,
      title: `Journal Entry ${new Date().toLocaleDateString()}`,
      videoPath: finalFilePath,
      duration,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clean up active stream tracking
    activeStreams.delete(streamId);

    return new Response(
      JSON.stringify({
        streamId,
        journalId,
        videoPath: finalFilePath,
        duration,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stream upload error:', error);

    // Clean up on error
    activeStreams.delete(streamId);

    return new Response(
      JSON.stringify({
        error: 'Stream upload failed',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle chunked video upload
 *
 * POST /api/journals/stream/chunk
 *
 * Uploads a single chunk of video data and appends it to the temporary file.
 * This avoids streaming/ALPN issues by using standard HTTP requests.
 *
 * Headers:
 * - X-Stream-ID: Stream identifier from init
 * - X-Chunk-Index: Index of this chunk
 * - X-Is-Last: "true" if this is the final chunk
 * - Content-Type: Video MIME type
 *
 * @returns Response with chunk status or error
 */
export async function handleStreamChunkUpload(request: Request): Promise<Response> {
  const streamId = request.headers.get('X-Stream-ID');
  const chunkIndex = request.headers.get('X-Chunk-Index');
  const isLast = request.headers.get('X-Is-Last') === 'true';
  const contentType = request.headers.get('Content-Type') || 'video/webm';

  if (!streamId) {
    return new Response(
      JSON.stringify({
        error: 'Missing stream ID',
        code: 'VALIDATION_ERROR',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const streamData = activeStreams.get(streamId);

  if (!streamData) {
    return new Response(
      JSON.stringify({
        error: 'Invalid or expired stream ID',
        code: 'INVALID_STREAM',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the chunk data as ArrayBuffer
    const chunkData = await request.arrayBuffer();
    const chunkBuffer = Buffer.from(chunkData);

    // Determine file extension from content type
    const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
    const tempFileName = `${streamId}.${ext}`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);

    // Append chunk to temporary file
    await appendFile(tempFilePath, chunkBuffer);

    // Update bytes received
    streamData.bytesReceived += chunkBuffer.length;

    // If this is the last chunk, finalize the recording
    if (isLast) {
      const finalFileName = `${streamId}.${ext}`;
      const finalFilePath = path.join(UPLOAD_DIR, finalFileName);

      // Move temp file to final location
      const fs = await import('node:fs/promises');
      await fs.rename(tempFilePath, finalFilePath);

      // Calculate duration from timing
      const duration = Math.max(1, Math.round((Date.now() - streamData.startTime) / 1000));

      // Create journal entry
      const journalId = randomUUID();
      await db.insert(journals).values({
        id: journalId,
        userId: streamData.userId,
        title: `Journal Entry ${new Date().toLocaleDateString()}`,
        videoPath: finalFilePath,
        duration,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Clean up active stream tracking
      activeStreams.delete(streamId);

      return new Response(
        JSON.stringify({
          streamId,
          journalId,
          videoPath: finalFilePath,
          duration,
          chunkIndex,
          isLast: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        streamId,
        chunkIndex,
        bytesReceived: streamData.bytesReceived,
        isLast: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chunk upload error:', error);

    // Clean up on error
    activeStreams.delete(streamId);

    return new Response(
      JSON.stringify({
        error: 'Chunk upload failed',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get all journals for the current user
 *
 * GET /api/journals
 *
 * @returns Response with list of journals or error
 */
export async function handleGetJournals(request: Request): Promise<Response> {
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

    // Get user's journals
    const userJournals = await db
      .select()
      .from(journals)
      .where(eq(journals.userId, session.user.id))
      .orderBy(journals.createdAt);

    return new Response(
      JSON.stringify({
        journals: userJournals,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get journals error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get a single journal by ID
 *
 * GET /api/journals/:id
 *
 * @returns Response with journal details or error
 */
export async function handleGetJournal(request: Request, journalId: string): Promise<Response> {
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

    // Get journal
    const journalList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    const journal = journalList[0];

    if (!journal) {
      return new Response(
        JSON.stringify({
          error: 'Journal not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (journal.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(journal),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get journal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete a journal by ID
 *
 * DELETE /api/journals/:id
 *
 * @returns Response indicating success or error
 */
export async function handleDeleteJournal(request: Request, journalId: string): Promise<Response> {
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

    // Get journal to verify ownership
    const journalList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    const journal = journalList[0];

    if (!journal) {
      return new Response(
        JSON.stringify({
          error: 'Journal not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (journal.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete journal from database
    await db.delete(journals).where(eq(journals.id, journalId));

    // Delete video file
    if (existsSync(journal.videoPath)) {
      await unlink(journal.videoPath).catch(() => {
        // Ignore file deletion errors
        console.warn(`Failed to delete video file: ${journal.videoPath}`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Journal deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete journal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update a journal by ID
 *
 * PUT /api/journals/:id
 *
 * @returns Response with updated journal or error
 */
export async function handleUpdateJournal(
  request: Request,
  journalId: string
): Promise<Response> {
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

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      notes?: string;
      location?: string;
    };
    const { title, notes, location } = body;

    // Get journal to verify ownership
    const journalList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    const journal = journalList[0];

    if (!journal) {
      return new Response(
        JSON.stringify({
          error: 'Journal not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (journal.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (location !== undefined) updateData.location = location;

    // Update journal
    await db
      .update(journals)
      .set(updateData)
      .where(eq(journals.id, journalId));

    // Get updated journal
    const updatedList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    return new Response(
      JSON.stringify(updatedList[0]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update journal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export type {
  ActiveStream,
};
