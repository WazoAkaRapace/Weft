import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality: number; // 1-31 for JPEG (lower is better)
  timestamp: string; // Frame position (e.g., "00:00:01")
  format: 'jpg' | 'webp';
}

const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailOptions = {
  width: 320,
  height: 180, // 16:9 aspect ratio
  quality: 6, // Good quality JPEG
  timestamp: '00:00:01', // 1 second into video
  format: 'jpg',
};

/**
 * Generate a thumbnail from a video file using FFmpeg
 *
 * @param videoPath - Full path to the video file
 * @param outputPath - Full path where thumbnail should be saved
 * @param options - Thumbnail generation options
 * @returns Promise that resolves when thumbnail is generated
 * @throws Error if FFmpeg fails or video file doesn't exist
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  options: Partial<ThumbnailOptions> = {}
): Promise<void> {
  // Validate input video exists
  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };

  // Build FFmpeg command
  const args = [
    '-i',
    videoPath, // Input file
    '-ss',
    opts.timestamp, // Seek position
    '-vframes',
    '1', // Extract single frame
    '-vf',
    `scale=${opts.width}:${opts.height}`, // Resize
    '-q:v',
    String(opts.quality), // JPEG quality
    '-y', // Overwrite output
    outputPath,
  ];

  // Spawn FFmpeg process
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Generate thumbnail path from video path
 * e.g., /uploads/abc123.mp4 -> /uploads/abc123-thumbnail.jpg
 */
export function getThumbnailPath(videoPath: string): string {
  const dir = path.dirname(videoPath);
  const ext = path.extname(videoPath);
  const basename = path.basename(videoPath, ext);
  return path.join(dir, `${basename}-thumbnail.jpg`);
}

/**
 * Generate thumbnail with automatic path handling
 */
export async function generateThumbnailForVideo(
  videoPath: string,
  options?: Partial<ThumbnailOptions>
): Promise<string> {
  const thumbnailPath = getThumbnailPath(videoPath);
  await generateThumbnail(videoPath, thumbnailPath, options);
  return thumbnailPath;
}
