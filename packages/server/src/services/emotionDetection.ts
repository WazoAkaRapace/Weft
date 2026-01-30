/**
 * Emotion Detection Service
 * Handles facial emotion recognition from video frames using face-api
 */

import { spawn } from 'node:child_process';
import { readFile, unlink, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const TEMP_DIR = path.join(UPLOAD_DIR, 'temp');
const MODEL_DIR = process.env.FACEAPI_MODELS_DIR || path.join(UPLOAD_DIR, 'models', 'face-api');
const FRAME_SAMPLING_INTERVAL = 5; // Sample every 5 seconds
const MIN_CONFIDENCE = 0.5; // Minimum confidence for emotion detection

// Ensure temp directory exists
async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

// Emotion labels
export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] as const;
export type EmotionLabel = typeof EMOTIONS[number];

export interface EmotionJob {
  journalId: string;
  userId: string;
  videoPath: string;
  retryCount?: number;
}

export interface EmotionTimelineEntry {
  time: number;      // Timestamp in seconds
  emotion: string;   // Emotion label
  confidence: number; // 0-1 confidence score
}

export interface EmotionResult {
  dominantEmotion: string;
  timeline: EmotionTimelineEntry[];
  scores: Record<string, number>; // { happy: 0.45, sad: 0.10, ... }
}

// Models loaded flag
let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

/**
 * Download model files from URLs
 */
async function downloadModel(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
  console.log(`[EmotionDetection] Downloaded: ${path.basename(outputPath)}`);
}

/**
 * Download all required face-api models
 */
async function downloadModels(): Promise<void> {
  if (!existsSync(MODEL_DIR)) {
    await mkdir(MODEL_DIR, { recursive: true });
  }

  const models = [
    {
      url: 'https://raw.githubusercontent.com/vladmandic/face-api/main/model/tiny_face_detector_model-weights_manifest.json',
      file: path.join(MODEL_DIR, 'tiny_face_detector_model-weights_manifest.json'),
    },
    {
      url: 'https://raw.githubusercontent.com/vladmandic/face-api/main/model/tiny_face_detector_model-shard1',
      file: path.join(MODEL_DIR, 'tiny_face_detector_model-shard1'),
    },
    {
      url: 'https://raw.githubusercontent.com/vladmandic/face-api/main/model/face_expression_model-weights_manifest.json',
      file: path.join(MODEL_DIR, 'face_expression_model-weights_manifest.json'),
    },
    {
      url: 'https://raw.githubusercontent.com/vladmandic/face-api/main/model/face_expression_model-shard1',
      file: path.join(MODEL_DIR, 'face_expression_model-shard1'),
    },
  ];

  // Check which models need to be downloaded
  const missingModels = models.filter((model) => !existsSync(model.file));

  if (missingModels.length === 0) {
    console.log('[EmotionDetection] All models already present');
    return;
  }

  console.log(`[EmotionDetection] Downloading ${missingModels.length} missing model(s)...`);

  for (const model of missingModels) {
    await downloadModel(model.url, model.file);
  }

  console.log('[EmotionDetection] Model download complete');
}

/**
 * Get or initialize face-api models
 */
async function ensureModels(): Promise<void> {
  if (modelsLoaded) {
    return;
  }

  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }

  modelLoadingPromise = (async () => {
    try {
      // Lazy import face-api to avoid TensorFlow binding issues at startup
      const faceapi = await import('@vladmandic/face-api');

      // Download models if they don't exist
      await downloadModels();

      console.log(`[EmotionDetection] Loading face-api models from: ${MODEL_DIR}`);

      // Load required models
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
      await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);

      modelsLoaded = true;
      modelLoadingPromise = null;
      console.log('[EmotionDetection] Models loaded successfully');
    } catch (error) {
      modelLoadingPromise = null;
      throw new Error(
        `Failed to load face-api models: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  })();

  return modelLoadingPromise;
}

/**
 * Extract a single frame from video at specific timestamp using FFmpeg
 */
async function extractFrame(videoPath: string, timeSeconds: number): Promise<Buffer> {
  await ensureTempDir();

  const framePath = path.join(TEMP_DIR, `${randomUUID()}.jpg`);

  return new Promise((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const ffmpeg = spawn(ffmpegPath, [
      '-ss', String(timeSeconds), // Seek to timestamp
      '-i', videoPath,
      '-vframes', '1', // Extract single frame
      '-q:v', '2', // High quality
      '-y', // Overwrite output file
      framePath,
    ]);

    let stderrData = '';

    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          const buffer = await readFile(framePath);
          await unlink(framePath).catch(() => {});
          resolve(buffer);
        } catch (error) {
          reject(new Error(`Failed to read frame: ${error instanceof Error ? error.message : String(error)}`));
        }
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
 * Detect emotions from an image buffer
 * Returns the dominant emotion with confidence, or null if no face detected
 */
async function detectEmotions(imageBuffer: Buffer): Promise<{ emotion: string; confidence: number } | null> {
  await ensureModels();

  try {
    // Lazy import face-api to avoid TensorFlow binding issues at startup
    const faceapi = await import('@vladmandic/face-api');

    // Create a canvas from the image buffer
    // @vladmandic/face-api works with canvas elements in Node.js
    const { createCanvas, loadImage } = await import('canvas');

    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Detect face and expressions
    const detections = await faceapi
      .detectAllFaces(canvas as any, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (detections.length === 0) {
      return null;
    }

    // Get the first (largest) face detection
    const detection = detections[0];
    const expressions = detection.expressions;

    // Find the dominant emotion (highest score)
    let dominantEmotion = 'neutral';
    let highestScore = 0;

    for (const [emotion, score] of Object.entries(expressions)) {
      if (score > highestScore) {
        highestScore = score;
        dominantEmotion = emotion;
      }
    }

    // Filter by minimum confidence
    if (highestScore < MIN_CONFIDENCE) {
      return null;
    }

    return {
      emotion: dominantEmotion,
      confidence: highestScore,
    };
  } catch (error) {
    console.error('[EmotionDetection] Failed to detect emotions:', error);
    return null;
  }
}

/**
 * Emotion Detection Service class
 */
export class EmotionDetectionService {
  /**
   * Analyze emotions from a video file
   */
  async analyze(job: EmotionJob): Promise<EmotionResult> {
    const startTime = Date.now();

    try {
      // Get journal details from database
      const journal = await db
        .select({ duration: journals.duration })
        .from(journals)
        .where(eq(journals.id, job.journalId))
        .limit(1);

      if (journal.length === 0) {
        throw new Error(`Journal ${job.journalId} not found`);
      }

      const duration = journal[0].duration;
      console.log(`[EmotionDetection] Analyzing journal ${job.journalId} (${duration}s duration)`);

      const timeline: EmotionTimelineEntry[] = [];
      const emotionCounts: Record<string, number> = {};
      let totalDetections = 0;

      // Initialize emotion counts
      for (const emotion of EMOTIONS) {
        emotionCounts[emotion] = 0;
      }

      // Sample frames at regular intervals
      for (let time = 0; time < duration; time += FRAME_SAMPLING_INTERVAL) {
        console.log(`[EmotionDetection] Processing frame at ${time}s`);

        try {
          const frameBuffer = await extractFrame(job.videoPath, time);
          const result = await detectEmotions(frameBuffer);

          if (result) {
            timeline.push({
              time,
              emotion: result.emotion,
              confidence: result.confidence,
            });

            emotionCounts[result.emotion]++;
            totalDetections++;
          } else {
            // No face detected or low confidence - add neutral entry
            timeline.push({
              time,
              emotion: 'neutral',
              confidence: 0,
            });
          }
        } catch (error) {
          console.error(`[EmotionDetection] Failed to process frame at ${time}s:`, error);
          // Add neutral entry for failed frames
          timeline.push({
            time,
            emotion: 'neutral',
            confidence: 0,
          });
        }
      }

      // Calculate emotion distribution scores
      const scores: Record<string, number> = {};
      for (const emotion of EMOTIONS) {
        scores[emotion] = totalDetections > 0 ? emotionCounts[emotion] / totalDetections : 0;
      }

      // Determine dominant emotion (highest score)
      let dominantEmotion = 'neutral';
      let highestScore = 0;
      for (const [emotion, score] of Object.entries(scores)) {
        if (score > highestScore) {
          highestScore = score;
          dominantEmotion = emotion;
        }
      }

      const result: EmotionResult = {
        dominantEmotion,
        timeline,
        scores,
      };

      const durationMs = Date.now() - startTime;
      console.log(`[EmotionDetection] Analysis complete in ${durationMs}ms`);
      console.log(`[EmotionDetection] Dominant: ${dominantEmotion}, Frames analyzed: ${timeline.length}`);

      return result;
    } catch (error) {
      console.error('[EmotionDetection] Analysis failed:', error);
      throw new Error(
        `Emotion detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save emotion detection results to database
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

  /**
   * Check if FFmpeg is available
   */
  static async checkFFmpegAvailable(): Promise<boolean> {
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
}
