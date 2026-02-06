/**
 * Journal streaming API routes
 *
 * Handles video streaming endpoints for journal creation:
 * - POST /api/journals/stream/init - Initialize a new stream
 * - POST /api/journals/stream - Upload stream data
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { journals, transcripts, notes, journalNotes } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq, desc, gte, lte, or, ilike, and, sql } from 'drizzle-orm';
import { getTranscriptionQueue } from '../queue/TranscriptionQueue.js';
import { getEmotionQueue } from '../queue/EmotionQueue.js';
import { getHLSQueue } from '../queue/HLSQueue.js';
import { generateThumbnailForVideo } from '../lib/thumbnail.js';
import { cleanupHLSFiles } from '../lib/hls.js';

// Upload directory configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
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

    // Read stream and write to file
    const reader = request.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({
          error: 'No request body',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      totalBytes += value.length;
      streamData.bytesReceived = totalBytes;
    }

    // Combine chunks and write to file
    const fileBuffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    await writeFile(finalFilePath, fileBuffer);

    // Calculate duration from timing
    const duration = Math.max(1, Math.round((Date.now() - streamData.startTime) / 1000));

    // Generate thumbnail for the video
    let thumbnailPath: string | undefined;
    try {
      thumbnailPath = await generateThumbnailForVideo(finalFilePath);
      console.log(`[Journals] Thumbnail generated: ${thumbnailPath}`);
    } catch (error) {
      console.error('[Journals] Failed to generate thumbnail:', error);
      // Don't fail the upload if thumbnail generation fails
    }

    // Create journal entry
    const journalId = randomUUID();
    await db.insert(journals).values({
      id: journalId,
      userId: streamData.userId,
      title: `Journal Entry ${new Date().toLocaleDateString()}`,
      videoPath: finalFilePath,
      duration,
      thumbnailPath,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Start transcription job (non-blocking)
    try {
      const queue = getTranscriptionQueue();
      await queue.addJob({
        journalId,
        userId: streamData.userId,
        videoPath: finalFilePath,
      });
      console.log(`[Journals] Transcription job queued for journal ${journalId}`);
    } catch (error) {
      // Log error but don't fail the upload
      console.error('[Journals] Failed to queue transcription job:', error);
    }

    // Start emotion detection job (non-blocking)
    try {
      const emotionQueue = getEmotionQueue();
      await emotionQueue.addJob({
        journalId,
        userId: streamData.userId,
        videoPath: finalFilePath,
      });
      console.log(`[Journals] Emotion detection job queued for journal ${journalId}`);
    } catch (error) {
      // Log error but don't fail the upload
      console.error('[Journals] Failed to queue emotion detection job:', error);
    }

    // Start HLS transcoding job (non-blocking)
    try {
      const hlsQueue = getHLSQueue();
      await hlsQueue.addJob({
        journalId,
        userId: streamData.userId,
        videoPath: finalFilePath,
      });
      console.log(`[Journals] HLS transcoding job queued for journal ${journalId}`);
    } catch (error) {
      // Log error but don't fail the upload
      console.error('[Journals] Failed to queue HLS transcoding job:', error);
    }

    // Clean up active stream tracking
    activeStreams.delete(streamId);

    return new Response(
      JSON.stringify({
        streamId,
        journalId,
        videoPath: finalFilePath,
        thumbnailPath,
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

      // Generate thumbnail for the video
      let thumbnailPath: string | undefined;
      try {
        thumbnailPath = await generateThumbnailForVideo(finalFilePath);
        console.log(`[Journals] Thumbnail generated: ${thumbnailPath}`);
      } catch (error) {
        console.error('[Journals] Failed to generate thumbnail:', error);
        // Don't fail the upload if thumbnail generation fails
      }

      // Create journal entry
      const journalId = randomUUID();
      await db.insert(journals).values({
        id: journalId,
        userId: streamData.userId,
        title: `Journal Entry ${new Date().toLocaleDateString()}`,
        videoPath: finalFilePath,
        duration,
        thumbnailPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Start transcription job (non-blocking)
      try {
        const queue = getTranscriptionQueue();
        await queue.addJob({
          journalId,
          userId: streamData.userId,
          videoPath: finalFilePath,
        });
        console.log(`[Journals] Transcription job queued for journal ${journalId}`);
      } catch (error) {
        // Log error but don't fail the upload
        console.error('[Journals] Failed to queue transcription job:', error);
      }

      // Start emotion detection job (non-blocking)
      try {
        const emotionQueue = getEmotionQueue();
        await emotionQueue.addJob({
          journalId,
          userId: streamData.userId,
          videoPath: finalFilePath,
        });
        console.log(`[Journals] Emotion detection job queued for journal ${journalId}`);
      } catch (error) {
        // Log error but don't fail the upload
        console.error('[Journals] Failed to queue emotion detection job:', error);
      }

      // Start HLS transcoding job (non-blocking)
      try {
        const hlsQueue = getHLSQueue();
        await hlsQueue.addJob({
          journalId,
          userId: streamData.userId,
          videoPath: finalFilePath,
        });
        console.log(`[Journals] HLS transcoding job queued for journal ${journalId}`);
      } catch (error) {
        // Log error but don't fail the upload
        console.error('[Journals] Failed to queue HLS transcoding job:', error);
      }

      // Clean up active stream tracking
      activeStreams.delete(streamId);

      return new Response(
        JSON.stringify({
          streamId,
          journalId,
          videoPath: finalFilePath,
          thumbnailPath,
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
 * Get paginated journals for the current user
 *
 * GET /api/journals/paginated?page=1&limit=20&startDate=2024-01-01&endDate=2024-12-31&search=query
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - startDate: ISO date string for filtering (optional)
 * - endDate: ISO date string for filtering (optional)
 * - search: Text search in title/notes (optional)
 *
 * @returns Response with paginated journals
 */
export async function handleGetPaginatedJournals(request: Request): Promise<Response> {
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

    // Parse query parameters
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') || '20'))
    );
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const search = url.searchParams.get('search');

    // Build query conditions
    const conditions = [eq(journals.userId, session.user.id)];

    // Add date filtering
    if (startDate) {
      const start = new Date(startDate);
      conditions.push(gte(journals.createdAt, start));
    }

    if (endDate) {
      // Include the entire end date
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(journals.createdAt, end));
    }

    // Add text search (in title or notes)
    if (search) {
      const searchCondition = or(
        ilike(journals.title, `%${search}%`),
        ilike(journals.notes, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(journals)
      .where(and(...conditions));
    const { count } = countResult[0] || { count: 0 };

    // Calculate offset
    const offset = (page - 1) * limit;

    // Fetch paginated results with transcript preview
    const userJournals = await db
      .select({
        id: journals.id,
        userId: journals.userId,
        title: journals.title,
        videoPath: journals.videoPath,
        thumbnailPath: journals.thumbnailPath,
        duration: journals.duration,
        location: journals.location,
        notes: journals.notes,
        manualMood: journals.manualMood,
        dominantEmotion: journals.dominantEmotion,
        emotionTimeline: journals.emotionTimeline,
        emotionScores: journals.emotionScores,
        createdAt: journals.createdAt,
        updatedAt: journals.updatedAt,
        transcriptText: transcripts.text,
      })
      .from(journals)
      .leftJoin(transcripts, eq(transcripts.journalId, journals.id))
      .where(and(...conditions))
      .orderBy(desc(journals.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limit);

    // Format journals to include transcript preview
    const formattedJournals = userJournals.map((journal: any) => ({
      ...journal,
      transcriptPreview: journal.transcriptText
        ? journal.transcriptText.slice(0, 100) + (journal.transcriptText.length > 100 ? '...' : '')
        : null,
    }));

    return new Response(
      JSON.stringify({
        data: formattedJournals,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get paginated journals error:', error);
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
 * Get notes linked to a journal
 *
 * GET /api/journals/:id/notes
 *
 * @returns Response with list of linked notes or error
 */
export async function handleGetJournalNotes(request: Request, journalId: string): Promise<Response> {
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

    // Verify journal exists and belongs to user
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

    if (journal.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get linked notes
    const linkedNotes = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        title: notes.title,
        content: notes.content,
        icon: notes.icon,
        color: notes.color,
        parentId: notes.parentId,
        position: notes.position,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        linkedAt: journalNotes.createdAt,
      })
      .from(journalNotes)
      .innerJoin(notes, eq(journalNotes.noteId, notes.id))
      .where(eq(journalNotes.journalId, journalId))
      .orderBy(desc(journalNotes.createdAt));

    return new Response(
      JSON.stringify({
        notes: linkedNotes,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get journal notes error:', error);
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

    // Clean up HLS files
    try {
      await cleanupHLSFiles(journal.videoPath);
    } catch (error) {
      console.warn(`[Journals] Failed to clean up HLS files:`, error);
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
      manualMood?: string | null;
    };
    const { title, notes, location, manualMood } = body;

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
    if (manualMood !== undefined) updateData.manualMood = manualMood;

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

/**
 * Get transcript for a journal
 *
 * GET /api/journals/:id/transcript
 *
 * @returns Response with transcript or error
 */
export async function handleGetTranscript(
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

    // Get transcript
    const transcriptList = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.journalId, journalId))
      .limit(1);

    const transcript = transcriptList[0];

    if (!transcript) {
      // Check if job is in queue
      const queue = getTranscriptionQueue();
      const job = queue.getJobByJournalId(journalId);

      if (job) {
        return new Response(
          JSON.stringify({
            status: job.status,
            error: job.error,
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Transcript not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(transcript),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get transcript error:', error);
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
 * Retry transcription for a journal
 *
 * POST /api/journals/:id/transcription/retry
 *
 * @returns Response indicating success or error
 */
export async function handleRetryTranscription(
  request: Request,
  journalId: string
): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get journal to verify ownership and get video path
    const journalList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    const journal = journalList[0];

    if (!journal) {
      return Response.json(
        { error: 'Journal not found', code: 'NOT_FOUND' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (journal.userId !== session.user.id) {
      return Response.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing transcript if any
    await db.delete(transcripts).where(eq(transcripts.journalId, journalId));

    // Queue new transcription job
    const queue = getTranscriptionQueue();
    const jobId = await queue.addJob({
      journalId,
      userId: journal.userId,
      videoPath: journal.videoPath,
    });
    console.log(`[Journals] Transcription retry queued for journal ${journalId}`);

    return Response.json(
      {
        data: { message: 'Transcription queued', jobId },
        error: null,
        code: 'SUCCESS',
      },
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Retry transcription error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Failed to queue transcription',
        code: 'ERROR',
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get all job statuses for a journal
 *
 * GET /api/journals/:id/jobs
 *
 * Returns the current status of transcription and emotion detection jobs.
 *
 * @returns Response with job statuses or error
 */
export async function handleGetJobsStatus(
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

    // Check transcription job status
    const transcriptionQueue = getTranscriptionQueue();
    const transcriptionJob = transcriptionQueue.getJobByJournalId(journalId);
    let transcriptionStatus: { status: string; error?: string } | null = null;

    if (transcriptionJob) {
      // Job exists in queue - use queue status
      // But if queue says completed, verify the data actually exists in database
      if (transcriptionJob.status === 'completed') {
        // Verify transcript actually exists in database
        const transcriptList = await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.journalId, journalId))
          .limit(1);

        if (transcriptList.length > 0 && transcriptList[0].text) {
          transcriptionStatus = { status: 'completed' };
        } else {
          // Queue says completed but data not in DB yet - still processing
          transcriptionStatus = { status: 'processing' };
        }
      } else {
        transcriptionStatus = {
          status: transcriptionJob.status,
          error: transcriptionJob.error,
        };
      }
    } else {
      // No job in queue - check if transcript exists in database
      const transcriptList = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.journalId, journalId))
        .limit(1);

      if (transcriptList.length > 0 && transcriptList[0].text) {
        transcriptionStatus = { status: 'completed' };
      }
    }

    // Check emotion job status
    const emotionQueue = getEmotionQueue();
    const emotionJob = emotionQueue.getJobByJournalId(journalId);
    let emotionStatus: { status: string; error?: string } | null = null;

    if (emotionJob) {
      // Job exists in queue - use queue status
      // But if queue says completed, verify the data actually exists in database
      if (emotionJob.status === 'completed') {
        // Verify emotion data actually exists in database
        if (journal.dominantEmotion && journal.emotionTimeline && journal.emotionScores) {
          emotionStatus = { status: 'completed' };
        } else {
          // Queue says completed but data not in DB yet - still processing
          emotionStatus = { status: 'processing' };
        }
      } else {
        emotionStatus = {
          status: emotionJob.status,
          error: emotionJob.error,
        };
      }
    } else if (journal.dominantEmotion && journal.emotionTimeline && journal.emotionScores) {
      // No job in queue and data exists in database - completed
      emotionStatus = { status: 'completed' };
    }

    return new Response(
      JSON.stringify({
        transcription: transcriptionStatus,
        emotion: emotionStatus,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get jobs status error:', error);
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
