/**
 * Voice Emotion Detection Service
 * Integrates with Python SpeechBrain service for audio emotion recognition
 */

import { spawn } from 'node:child_process';
import { readFile, unlink, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const TEMP_DIR = path.join(UPLOAD_DIR, 'temp');
const VOICE_EMOTION_API_URL = process.env.VOICE_EMOTION_API_URL || 'http://voice-emotion-recognition:8000';
const AUDIO_SEGMENT_DURATION = 5; // Sample every 5 seconds (same as face)
const MIN_CONFIDENCE = 0.3; // Lower threshold for voice (less accurate than face)

// Voice emotion labels (SpeechBrain IEMOCAP)
export const VOICE_EMOTIONS = ['angry', 'happy', 'neutral', 'sad'] as const;
export type VoiceEmotionLabel = typeof VOICE_EMOTIONS[number];

export interface VoiceEmotionJob {
  journalId: string;
  userId: string;
  audioPath: string; // Path to extracted audio file
  duration: number; // Total audio duration in seconds
}

export interface VoiceEmotionTimelineEntry {
  time: number;      // Timestamp in seconds
  emotion: string;   // Emotion label
  confidence: number; // 0-1 confidence score
}

export interface VoiceEmotionResult {
  dominantEmotion: string;
  timeline: VoiceEmotionTimelineEntry[];
  scores: Record<string, number>; // { angry: 0.25, happy: 0.35, ... }
}

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

/**
 * Voice Emotion Detection Service class
 */
export class VoiceEmotionDetectionService {
  private apiAvailable: boolean = true;

  /**
   * Check if the Python service is available
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const curl = spawn('curl', [
          '--max-time', '5',
          '--silent',
          '--fail',
          `${VOICE_EMOTION_API_URL}/health`,
        ]);

        curl.on('close', (code) => {
          resolve(code === 0);
        });

        curl.on('error', () => {
          resolve(false);
        });
      });
      this.apiAvailable = result;
      return result;
    } catch (error) {
      console.error('[VoiceEmotion] Service health check failed:', error);
      this.apiAvailable = false;
      return false;
    }
  }

  /**
   * Extract a segment from audio file at specific timestamp
   * Reuses FFmpeg logic from transcription service
   */
  private async extractAudioSegment(
    audioPath: string,
    startTime: number,
    duration: number
  ): Promise<Buffer> {
    await ensureTempDir();

    const segmentPath = path.join(TEMP_DIR, `${randomUUID()}.wav`);

    return new Promise((resolve, reject) => {
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffmpeg = spawn(ffmpegPath, [
        '-i', audioPath,
        '-ss', String(startTime),
        '-t', String(duration),
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        segmentPath,
      ]);

      let stderrData = '';

      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            const buffer = await readFile(segmentPath);
            await unlink(segmentPath).catch(() => {});
            resolve(buffer);
          } catch (error) {
            reject(new Error(`Failed to read segment: ${error instanceof Error ? error.message : String(error)}`));
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
   * Predict emotion from audio buffer using Python service
   */
  private async predictEmotion(audioBuffer: Buffer): Promise<{
    emotion: string;
    confidence: number;
    scores: Record<string, number>;
  } | null> {
    if (!this.apiAvailable) {
      console.warn('[VoiceEmotion] Service unavailable, skipping prediction');
      return null;
    }

    try {
      console.log('[VoiceEmotion] Sending prediction request...');

      await ensureTempDir();

      // Save audio buffer to temp file for curl
      const tempAudioPath = path.join(TEMP_DIR, `${randomUUID()}.wav`);
      await writeFile(tempAudioPath, audioBuffer);

      console.log('[VoiceEmotion] Temp audio file:', tempAudioPath);

      // Use curl for reliable HTTP requests
      const result = await new Promise<{
        emotion: string;
        confidence: number;
        scores: Record<string, number>;
      } | null>((resolve, reject) => {
        const curl = spawn('curl', [
          '-X', 'POST',
          `${VOICE_EMOTION_API_URL}/predict`,
          '-F', `audio_file=@${tempAudioPath}`,
          '--max-time', '30',
          '--silent',
        ]);

        let stdout = '';
        let stderr = '';

        curl.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        curl.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        curl.on('close', async (code) => {
          // Clean up temp file
          unlink(tempAudioPath).catch(() => {});

          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              console.log('[VoiceEmotion] Prediction response received:', result.emotion);
              resolve(result);
            } catch (error) {
              console.error('[VoiceEmotion] Failed to parse response:', stdout);
              reject(new Error(`Failed to parse response: ${error}`));
            }
          } else {
            console.error('[VoiceEmotion] Curl failed with code:', code, stderr);
            reject(new Error(`Curl failed with code ${code}: ${stderr}`));
          }
        });

        curl.on('error', async (error) => {
          unlink(tempAudioPath).catch(() => {});
          reject(error);
        });
      });

      return result;
    } catch (error: any) {
      console.error('[VoiceEmotion] Prediction failed:', error?.message || error);
      return null;
    }
  }

  /**
   * Analyze emotions from an audio file
   */
  async analyze(job: VoiceEmotionJob): Promise<VoiceEmotionResult> {
    const startTime = Date.now();

    try {
      // Check service health first
      await this.checkServiceHealth();

      if (!this.apiAvailable) {
        throw new Error('Voice emotion service is unavailable');
      }

      console.log(`[VoiceEmotion] Analyzing journal ${job.journalId} (${job.duration}s duration)`);

      const timeline: VoiceEmotionTimelineEntry[] = [];
      const emotionCounts: Record<string, number> = {};
      let totalDetections = 0;

      // Initialize emotion counts
      for (const emotion of VOICE_EMOTIONS) {
        emotionCounts[emotion] = 0;
      }

      // Sample audio segments at regular intervals (every 5 seconds)
      for (let time = 0; time < job.duration; time += AUDIO_SEGMENT_DURATION) {
        console.log(`[VoiceEmotion] Processing segment at ${time}s`);

        try {
          const segmentBuffer = await this.extractAudioSegment(
            job.audioPath,
            time,
            AUDIO_SEGMENT_DURATION
          );

          const result = await this.predictEmotion(segmentBuffer);

          if (result && result.confidence > MIN_CONFIDENCE) {
            timeline.push({
              time,
              emotion: result.emotion,
              confidence: result.confidence,
            });

            emotionCounts[result.emotion]++;
            totalDetections++;
          } else {
            // No clear emotion detected
            timeline.push({
              time,
              emotion: 'neutral',
              confidence: 0,
            });
          }
        } catch (error) {
          console.error(`[VoiceEmotion] Failed to process segment at ${time}s:`, error);
          timeline.push({
            time,
            emotion: 'neutral',
            confidence: 0,
          });
        }
      }

      // Calculate emotion distribution
      const scores: Record<string, number> = {};
      for (const emotion of VOICE_EMOTIONS) {
        scores[emotion] = totalDetections > 0 ? emotionCounts[emotion] / totalDetections : 0;
      }

      // Determine dominant emotion
      let dominantEmotion = 'neutral';
      let highestScore = 0;
      for (const [emotion, score] of Object.entries(scores)) {
        if (score > highestScore) {
          highestScore = score;
          dominantEmotion = emotion;
        }
      }

      const result: VoiceEmotionResult = {
        dominantEmotion,
        timeline,
        scores,
      };

      const durationMs = Date.now() - startTime;
      console.log(`[VoiceEmotion] Analysis complete in ${durationMs}ms`);
      console.log(`[VoiceEmotion] Dominant: ${dominantEmotion}, Segments: ${timeline.length}`);

      return result;
    } catch (error) {
      console.error('[VoiceEmotion] Analysis failed:', error);
      throw new Error(
        `Voice emotion detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
