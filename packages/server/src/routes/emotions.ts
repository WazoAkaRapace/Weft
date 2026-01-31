/**
 * Emotion Detection Routes
 * API endpoints for emotion data and re-analysis
 */

import { auth } from '../lib/auth.js';
import { getEmotionQueue } from '../queue/EmotionQueue.js';
import { EmotionDetectionService } from '../services/emotionDetection.js';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * GET /api/journals/:id/emotions
 * Get emotion detection results for a journal
 */
export async function getEmotions(request: Request, params: { id: string }) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const journalId = params.id;

    // Verify journal belongs to user
    const journal = await db
      .select({ userId: journals.userId })
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    if (journal.length === 0) {
      return Response.json(
        { error: 'Journal not found', code: 'NOT_FOUND' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (journal[0].userId !== session.user.id) {
      return Response.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const service = new EmotionDetectionService();
    const results = await service.getResults(journalId);

    // Check if analysis is in progress
    const queue = getEmotionQueue();
    const queuedJob = queue.getJobByJournalId(journalId);

    const responseData = {
      ...results,
      processingStatus: queuedJob?.status || null,
    };

    return Response.json(
      { data: responseData, error: null, code: 'SUCCESS' },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[EmotionsRoute] GET error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get emotion data',
        code: 'ERROR',
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/journals/:id/emotions/retry
 * Re-run emotion analysis for a journal
 */
export async function retryEmotionAnalysis(request: Request, params: { id: string }) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const journalId = params.id;

    // Verify journal exists and belongs to user
    const journal = await db
      .select({ userId: journals.userId, videoPath: journals.videoPath })
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    if (journal.length === 0) {
      return Response.json(
        { error: 'Journal not found', code: 'NOT_FOUND' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (journal[0].userId !== session.user.id) {
      return Response.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const queue = getEmotionQueue();

    // Check if job is already in queue
    const existingJob = queue.getJobByJournalId(journalId);
    if (existingJob && (existingJob.status === 'pending' || existingJob.status === 'processing')) {
      return Response.json(
        {
          data: { message: 'Emotion analysis already in progress', status: existingJob.status },
          error: null,
          code: 'ALREADY_QUEUED',
        },
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add job to queue with force flag for manual retry
    const jobId = await queue.addJob({
      journalId,
      userId: session.user.id,
      videoPath: journal[0].videoPath,
      force: true,
    });

    return Response.json(
      {
        data: { message: 'Emotion analysis queued', jobId },
        error: null,
        code: 'SUCCESS',
      },
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[EmotionsRoute] RETRY error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Failed to queue emotion analysis',
        code: 'ERROR',
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
