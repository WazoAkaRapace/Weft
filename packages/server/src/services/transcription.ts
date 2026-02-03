/**
 * Transcription Service
 * Handles video transcription using whisper.cpp (via nodejs-whisper)
 */

import { spawn } from 'node:child_process';
import { db } from '../db/index.js';
import { transcripts, journals, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nodewhisper } from 'nodejs-whisper';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MODELS_DIR = path.join(UPLOAD_DIR, 'whisper-models');

// Ensure models directory exists
await mkdir(MODELS_DIR, { recursive: true });

/**
 * Extract audio from video using FFmpeg
 * Used by emotion detection service
 */
export async function extractAudio(videoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(UPLOAD_DIR, 'temp');
    mkdir(tempDir, { recursive: true }).catch(() => {});
    const audioPath = path.join(tempDir, `${randomUUID()}.wav`);

    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const ffmpeg = spawn(ffmpegPath, [
      '-i', videoPath,
      '-vn', // No video
      '-acodec', 'pcm_s16le', // 16-bit PCM
      '-ar', '16000', // 16kHz sample rate (Whisper requirement)
      '-ac', '1', // Mono
      '-y', // Overwrite output file
      audioPath,
    ]);

    let stderrData = '';

    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[Transcription] Audio extracted to ${audioPath}`);
        resolve(audioPath);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderrData}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}. Is FFmpeg installed?`));
    });
  });
}

// Convert user's model selection from Xenova format to nodejs-whisper format
function convertModelName(xenovaModel: string): string {
  // Map Xenova format to nodejs-whisper format
  // nodejs-whisper uses names without "ggml-" prefix and ".bin" extension
  const modelMap: Record<string, string> = {
    'Xenova/whisper-tiny': 'tiny',
    'Xenova/whisper-tiny.en': 'tiny.en',
    'Xenova/whisper-base': 'base',
    'Xenova/whisper-base.en': 'base.en',
    'Xenova/whisper-small': 'small',
    'Xenova/whisper-small.en': 'small.en',
    'Xenova/whisper-medium': 'medium',
    'Xenova/whisper-medium.en': 'medium.en',
    'Xenova/whisper-large': 'large',
    'Xenova/whisper-large-v2': 'large-v2',
    'Xenova/whisper-large-v3': 'large-v3-turbo', // nodejs-whisper uses large-v3-turbo
  };

  // Default to small if not found
  return modelMap[xenovaModel] || 'small';
}

export interface TranscriptionJob {
  journalId: string;
  userId: string;
  videoPath: string;
  retryCount?: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
}

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, ['-version']);
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Transcription Service class
 */
export class TranscriptionService {
  /**
   * Transcribe a video file using whisper.cpp via nodejs-whisper
   */
  async transcribe(job: TranscriptionJob): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // Check FFmpeg availability
      const ffmpegAvailable = await checkFFmpegAvailable();
      if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not installed or not available in PATH');
      }

      // Get user's preferred language and model
      const user = await db
        .select({ preferredLanguage: users.preferredLanguage, transcriptionModel: users.transcriptionModel })
        .from(users)
        .where(eq(users.id, job.userId))
        .limit(1);

      const language = user[0]?.preferredLanguage || 'en';
      const userModel = user[0]?.transcriptionModel || 'Xenova/whisper-small';
      const modelName = convertModelName(userModel);

      console.log(`[Transcription] Using model: ${modelName} for user ${job.userId}`);
      console.log(`[Transcription] Using language: ${language} for user ${job.userId}`);

      // Log memory before transcription
      const memBefore = process.memoryUsage();
      console.log(`[Transcription] Memory before transcription:`, {
        heapUsed: `${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memBefore.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memBefore.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memBefore.external / 1024 / 1024)}MB`,
      });

      console.log(`[Transcription] Starting transcription for journal ${job.journalId}`);
      console.log(`[Transcription] Video file: ${job.videoPath}`);

      // Create a temp directory for output files
      const outputDir = path.join(UPLOAD_DIR, 'temp', randomUUID());
      await mkdir(outputDir, { recursive: true });

      const inferenceStart = Date.now();

      // Call nodejs-whisper
      // nodejs-whisper handles audio conversion automatically
      // Models are pre-downloaded during Docker build, so we skip autoDownloadModelName
      // nodejs-whisper returns the transcription result as stdout (text with timestamps)
      const transcriptOutput = await nodewhisper(job.videoPath, {
        modelName: modelName,
        // Skip autoDownloadModelName since models are pre-downloaded during Docker build
        // This prevents permission errors when running as non-root user
        removeWavFileAfterTranscription: true, // Clean up converted audio
        whisperOptions: {
          outputInJson: false,    // JSON saved to file, not needed for stdout
          outputInText: false,
          outputInSrt: true,      // Enable SRT output for timestamp parsing
          outputInVtt: false,
          outputInLrc: false,
          outputInJsonFull: false,
          wordTimestamps: false,  // Disable word-level timestamps for sentence-level output
          splitOnWord: false,     // Disable word-level splitting
        },
      });

      const inferenceTime = Date.now() - inferenceStart;

      // Log memory after transcription
      const memAfter = process.memoryUsage();
      console.log(`[Transcription] Memory after transcription:`, {
        heapUsed: `${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memAfter.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memAfter.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memAfter.external / 1024 / 1024)}MB`,
      });
      console.log(`[Transcription] Memory delta:`, {
        heapUsedDelta: `${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB`,
        rssDelta: `${Math.round((memAfter.rss - memBefore.rss) / 1024 / 1024)}MB`,
      });
      console.log(`[Transcription] Inference completed in ${inferenceTime}ms`);

      // The nodewhisper library returns SRT-formatted content in stdout
      // Even with outputInSrt: true, whisper.cpp doesn't write to a file - it outputs to stdout
      // So we use the stdout directly instead of trying to find a non-existent file
      console.log(`[Transcription] Using stdout for transcription output`);
      console.log(`[Transcription] Output length: ${transcriptOutput?.length || 0} characters`);
      console.log(`[Transcription] Output preview: ${transcriptOutput?.substring(0, 200)}...`);

      const result = this.parseSRTOutput(transcriptOutput);

      const duration = Date.now() - startTime;
      console.log(`[Transcription] Completed in ${duration}ms`);

      return result;
    } catch (error) {
      console.error('[Transcription] Failed:', error);

      // Log memory at error time
      const memError = process.memoryUsage();
      console.error(`[Transcription] Memory at error time:`, {
        heapUsed: `${Math.round(memError.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memError.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memError.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memError.external / 1024 / 1024)}MB`,
      });

      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert time string "HH:MM:SS.mmm" to seconds
   */
  private parseTimeString(timeStr: string): number {
    const [time, ms] = timeStr.split('.');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds + (parseInt(ms) || 0) / 1000;
  }

  /**
   * Parse SRT-style output from whisper.cpp
   * Format: [00:00:00.000 --> 00:00:00.530]   et
   */
  private parseSRTOutput(srtText: string): TranscriptionResult {
    if (!srtText || srtText.trim() === '') {
      return { text: '', segments: [] };
    }

    const segments: TranscriptSegment[] = [];
    const lines = srtText.trim().split('\n');
    const srtPattern = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)/;

    for (const line of lines) {
      const match = line.match(srtPattern);
      if (match) {
        const [, startTime, endTime, text] = match;
        segments.push({
          start: this.parseTimeString(startTime),
          end: this.parseTimeString(endTime),
          text: text.trim(),
        });
      }
    }

    console.log(`[Transcription] Parsed ${segments.length} raw segments from SRT output`);

    // Don't group segments - preserve original whisper.cpp segments for better timestamp granularity
    // This gives users more fine-grained control over transcript navigation
    const fullText = segments.map((s) => s.text).join(' ');
    return { text: fullText, segments };
  }

  /**
   * Save transcription result to database
   */
  async saveTranscription(
    journalId: string,
    result: TranscriptionResult
  ): Promise<void> {
    await db.insert(transcripts).values({
      journalId,
      text: result.text,
      segments: result.segments as any, // JSONB column
      createdAt: new Date(),
    });
    console.log(`[Transcription] Saved transcript for journal ${journalId}`);
  }

  /**
   * Get existing transcription for a journal
   */
  async getTranscription(journalId: string) {
    const results = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.journalId, journalId))
      .limit(1);

    return results[0] || null;
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
