/**
 * Emotion Detection Service
 * Voice-only emotion recognition using SpeechBrain
 */

import { VoiceEmotionDetectionService, type VoiceEmotionResult } from './voiceEmotionDetection.js';
import { extractAudio } from './transcription.js';
import { unlink } from 'node:fs/promises';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface EmotionJob {
  journalId: string;
  userId: string;
  videoPath: string;
  force?: boolean; // If true, regenerate even if emotion data already exists
}

export interface EmotionTimelineEntry {
  time: number;
  emotion: string;
  confidence: number;
  source: string[]; // ['voice']
}

export interface EmotionResult {
  dominantEmotion: string;
  timeline: EmotionTimelineEntry[];
  scores: Record<string, number>;
}

/**
 * Emotion Detection Service class (Voice-only)
 */
export class EmotionDetectionService {
  private voiceService: VoiceEmotionDetectionService;

  constructor() {
    this.voiceService = new VoiceEmotionDetectionService();
  }

  /**
   * Analyze emotions using voice
   */
  async analyze(job: EmotionJob): Promise<EmotionResult> {
    console.log(`[EmotionDetection] Starting voice analysis for journal ${job.journalId}`);

    // Get journal duration from database
    const journalData = await db
      .select({ duration: journals.duration })
      .from(journals)
      .where(eq(journals.id, job.journalId))
      .limit(1);

    if (journalData.length === 0) {
      throw new Error(`Journal ${job.journalId} not found`);
    }

    const duration = journalData[0].duration;

    const voiceResult = await this.runVoiceAnalysis(job, duration);

    console.log(`[EmotionDetection] Voice analysis complete: ${voiceResult.dominantEmotion}`);

    // Convert to EmotionResult format
    const result: EmotionResult = {
      dominantEmotion: voiceResult.dominantEmotion,
      timeline: voiceResult.timeline.map(entry => ({
        ...entry,
        source: ['voice'],
      })),
      scores: voiceResult.scores,
    };

    return result;
  }

  /**
   * Run voice emotion analysis
   */
  private async runVoiceAnalysis(job: EmotionJob, duration: number): Promise<VoiceEmotionResult> {
    const audioPath = await extractAudio(job.videoPath);

    try {
      // Run voice emotion detection
      const result = await this.voiceService.analyze({
        journalId: job.journalId,
        userId: job.userId,
        audioPath,
        duration,
      });

      return result;
    } finally {
      // Clean up audio file
      if (audioPath) {
        await unlink(audioPath).catch(() => {});
      }
    }
  }

  /**
   * Save emotion results to database
   */
  async saveResults(journalId: string, result: EmotionResult): Promise<void> {
    await db
      .update(journals)
      .set({
        dominantEmotion: result.dominantEmotion,
        emotionTimeline: result.timeline as any,
        emotionScores: result.scores as any,
      })
      .where(eq(journals.id, journalId));

    console.log(`[EmotionDetection] Saved results for journal ${journalId}`);
  }

  /**
   * Get existing emotion detection results for a journal
   */
  async getResults(journalId: string) {
    const journal = await db
      .select({
        dominantEmotion: journals.dominantEmotion,
        emotionTimeline: journals.emotionTimeline,
        emotionScores: journals.emotionScores,
      })
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    return journal[0] || null;
  }

  /**
   * Check if journal exists
   */
  async validateJournal(journalId: string): Promise<boolean> {
    const journal = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    return journal.length > 0;
  }
}
