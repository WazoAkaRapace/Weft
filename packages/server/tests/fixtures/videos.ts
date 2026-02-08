/**
 * Video test fixtures
 * Provides helper functions for creating test video files and streams
 */

import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getTestUploadDir } from '../setup.js';

const TEST_UPLOAD_DIR = getTestUploadDir();

/**
 * Ensure test upload directories exist
 */
export async function ensureTestUploadDirs(): Promise<void> {
  const dirs = [
    TEST_UPLOAD_DIR,
    path.join(TEST_UPLOAD_DIR, 'temp'),
    path.join(TEST_UPLOAD_DIR, 'videos'),
    path.join(TEST_UPLOAD_DIR, 'thumbnails'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

/**
 * Create a minimal test video file (WebM header)
 * In real tests, you'd use actual video files or mock FFmpeg
 */
export async function createTestVideoFile(filename?: string): Promise<string> {
  await ensureTestUploadDirs();

  const videoId = filename || `${randomUUID()}.webm`;
  const videoPath = path.join(TEST_UPLOAD_DIR, 'videos', videoId);

  // Minimal WebM header (real video would be larger)
  // This is just for testing file operations, not actual video playback
  const minimalWebm = Buffer.from([
    0x1A, 0x45, 0xDF, 0xA3, // EBML header
    0x01, 0x00, 0x00, 0x00, // EBML version
    0x42, 0x82, 0x80, // DocType
    0x6D, 0x61, 0x74, 0x72, 0x6F, 0x73, 0x6B, 0x61, // "matroska"
  ]);

  await writeFile(videoPath, minimalWebm);

  return videoPath;
}

/**
 * Create a test thumbnail file
 */
export async function createTestThumbnailFile(filename?: string): Promise<string> {
  await ensureTestUploadDirs();

  const thumbnailId = filename || `${randomUUID()}.jpg`;
  const thumbnailPath = path.join(TEST_UPLOAD_DIR, 'thumbnails', thumbnailId);

  // Minimal JPEG header (1x1 pixel black image)
  const minimalJpg = Buffer.from([
    0xFF, 0xD8, // JPEG SOI
    0xFF, 0xE0, 0x00, 0x10, // JFIF header
    0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF" identifier
    0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // JFIF info
    0xFF, 0xDB, 0x00, 0x43, 0x00, // Quantization table
    ...new Array(64).fill(0x10), // Default quantization table
    0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // Start of frame
    0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Huffman table
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, // Start of scan
    0x00, 0x3F, // Scan data
    0xFF, 0xD9, // JPEG EOI
  ]);

  await writeFile(thumbnailPath, minimalJpg);

  return thumbnailPath;
}

/**
 * Create test HLS manifest files
 */
export async function createTestHLSFiles(journalId: string): Promise<string> {
  await ensureTestUploadDirs();

  const hlsDir = path.join(TEST_UPLOAD_DIR, 'hls', journalId);
  await mkdir(hlsDir, { recursive: true });

  // Create master playlist
  const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480
480p.m3u8`;

  await writeFile(path.join(hlsDir, 'master.m3u8'), masterPlaylist);

  // Create a segment playlist
  const segmentPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts
#EXT-X-ENDLIST`;

  await writeFile(path.join(hlsDir, '360p.m3u8'), segmentPlaylist);

  return hlsDir;
}

/**
 * Create a mock video stream
 */
export interface MockVideoStream {
  streamId: string;
  chunks: Buffer[];
  totalSize: number;
}

export function createMockVideoStream(chunkCount = 5, chunkSize = 1024): MockVideoStream {
  const streamId = randomUUID();
  const chunks: Buffer[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const chunk = Buffer.alloc(chunkSize, i); // Fill with sequential bytes
    chunks.push(chunk);
  }

  return {
    streamId,
    chunks,
    totalSize: chunkCount * chunkSize,
  };
}

/**
 * Create a Request object with video chunk data
 */
export function createChunkUploadRequest(
  streamId: string,
  chunkData: Buffer,
  chunkIndex: number,
  isLast: boolean
): Request {
  return new Request('http://localhost:3001/api/journals/stream/chunk', {
    method: 'POST',
    headers: {
      'X-Stream-ID': streamId,
      'X-Chunk-Index': chunkIndex.toString(),
      'X-Is-Last': isLast ? 'true' : 'false',
      'Content-Type': 'video/webm',
    },
    body: chunkData,
  });
}

/**
 * Create test emotion timeline data
 */
export function createTestEmotionTimeline(duration = 60) {
  const timeline = [];
  const emotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];

  for (let t = 0; t < duration; t += 5) {
    timeline.push({
      time: t,
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      confidence: 0.5 + Math.random() * 0.5,
    });
  }

  return timeline;
}

/**
 * Create test emotion scores
 */
export function createTestEmotionScores() {
  const emotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];
  const scores: Record<string, number> = {};

  let total = 0;
  emotions.forEach(emotion => {
    scores[emotion] = Math.random();
    total += scores[emotion];
  });

  // Normalize to sum to 1
  Object.keys(scores).forEach(key => {
    scores[key] = scores[key] / total;
  });

  return scores;
}

/**
 * Clean up test files
 */
export async function cleanupTestFiles(): Promise<void> {
  // This is handled by the main test setup in afterEach
  // Individual test files are cleaned up via transaction rollback
}
