/**
 * Transcription Service
 * Handles video transcription using local Whisper (Transformers.js)
 */

import { pipeline } from '@huggingface/transformers';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { transcripts, journals } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import path from 'node:path';

export interface TranscriptionJob {
  journalId: string;
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

// Lazy-loaded pipeline instance
let transcriberPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;
let modelLoadingPromise: Promise<Awaited<ReturnType<typeof pipeline>>> | null = null;

/**
 * Get or initialize the transcription pipeline
 */
async function getPipeline() {
  if (transcriberPipeline) {
    return transcriberPipeline;
  }

  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }

  const modelName = process.env.TRANSCRIPTION_MODEL || 'Xenova/whisper-small.en';
  console.log(`[Transcription] Loading Whisper model: ${modelName}`);

  modelLoadingPromise = (async () => {
    try {
      const pipe = await pipeline('automatic-speech-recognition', modelName, {
        progress_callback: (progress: any) => {
          if (progress.status === 'download' && progress.progress !== undefined) {
            const percent = Math.round(progress.progress * 100);
            console.log(`[Transcription] Downloading model: ${percent}%`);
          } else if (progress.status === 'loading') {
            console.log(`[Transcription] Loading model...`);
          }
        },
      });
      transcriberPipeline = pipe;
      modelLoadingPromise = null;
      console.log(`[Transcription] Model loaded successfully`);
      return pipe;
    } catch (error) {
      modelLoadingPromise = null;
      throw new Error(`Failed to load Whisper model: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  return modelLoadingPromise;
}

/**
 * Extract audio from video using FFmpeg
 */
async function extractAudio(videoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
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
   * Transcribe a video file using local Whisper
   */
  async transcribe(job: TranscriptionJob): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // Check FFmpeg availability
      const ffmpegAvailable = await checkFFmpegAvailable();
      if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not installed or not available in PATH');
      }

      // Extract audio from video
      console.log(`[Transcription] Extracting audio from ${job.videoPath}`);
      const audioPath = await extractAudio(job.videoPath);

      try {
        // Get pipeline (loads model if needed)
        const pipe = await getPipeline();

        // Read audio file
        const audioBuffer = await readFile(audioPath);
        const audioData = new Uint8Array(audioBuffer);

        console.log(`[Transcription] Starting transcription for journal ${job.journalId}`);
        const output = await pipe(audioData, {
          chunk_length_s: 30,
          stride_length_s: 5,
          language: 'english',
          task: 'transcribe',
          return_timestamps: true,
        });

        // Parse result
        const result = this.parseTranscriptionOutput(output);

        const duration = Date.now() - startTime;
        console.log(`[Transcription] Completed in ${duration}ms`);

        return result;
      } finally {
        // Clean up temporary audio file
        if (existsSync(audioPath)) {
          await unlink(audioPath).catch(() => {
            console.warn(`[Transcription] Failed to delete temp file: ${audioPath}`);
          });
        }
      }
    } catch (error) {
      console.error('[Transcription] Failed:', error);
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse transcription output from Transformers.js
   */
  private parseTranscriptionOutput(output: any): TranscriptionResult {
    // Transformers.js returns different formats depending on options
    // With return_timestamps: true, we get chunks with timestamps
    if (output?.chunks && Array.isArray(output.chunks)) {
      return {
        text: output.text || output.chunks.map((c: any) => c.text).join(' '),
        segments: output.chunks.map((chunk: any) => ({
          start: chunk.timestamp?.[0] || 0,
          end: chunk.timestamp?.[1] || 0,
          text: chunk.text || '',
        })),
      };
    }

    // Fallback for simple text output
    return {
      text: output?.text || String(output),
      segments: [],
    };
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
