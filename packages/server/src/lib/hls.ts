/**
 * HLS Transcoding Utility
 *
 * Transcodes video files to HLS format with multiple quality renditions
 * for adaptive streaming using FFmpeg.
 */

import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface HLSRendition {
  name: string;
  resolution: string; // e.g., "1280x720"
  videoBitrate: string; // e.g., "2000k"
  audioBitrate: string; // e.g., "128k"
  bandwidth: number; // For master playlist (in bits)
}

export interface HLSTranscodeOptions {
  segmentDuration?: number; // Segment duration in seconds (default: 6)
  renditions?: HLSRendition[];
}

const DEFAULT_RENDITIONS: HLSRendition[] = [
  { name: '720p', resolution: '1280x720', videoBitrate: '2000k', audioBitrate: '128k', bandwidth: 2_500_000 },
  { name: '480p', resolution: '854x480', videoBitrate: '1000k', audioBitrate: '96k', bandwidth: 1_200_000 },
  { name: '360p', resolution: '640x360', videoBitrate: '600k', audioBitrate: '64k', bandwidth: 700_000 },
];

const DEFAULT_OPTIONS: HLSTranscodeOptions = {
  segmentDuration: 6,
  renditions: DEFAULT_RENDITIONS,
};

/**
 * Get HLS output directory for a video
 * e.g., /uploads/abc123.mp4 -> /uploads/abc123-hls/
 */
function getHLSOutputDir(videoPath: string): string {
  const dir = path.dirname(videoPath);
  const ext = path.extname(videoPath);
  const basename = path.basename(videoPath, ext);
  return path.join(dir, `${basename}-hls`);
}

/**
 * Get master playlist path
 * e.g., /uploads/abc123-hls/master.m3u8
 */
function getMasterPlaylistPath(videoPath: string): string {
  const outputDir = getHLSOutputDir(videoPath);
  return path.join(outputDir, 'master.m3u8');
}

/**
 * Transcode a single video to a specific HLS rendition
 *
 * @param videoPath - Full path to the input video file
 * @param outputDir - Directory where HLS files will be written
 * @param rendition - Quality rendition configuration
 * @param segmentDuration - Segment duration in seconds
 * @returns Promise that resolves when transcoding completes
 * @throws Error if FFmpeg fails or video file doesn't exist
 */
async function transcodeRendition(
  videoPath: string,
  outputDir: string,
  rendition: HLSRendition,
  segmentDuration: number
): Promise<void> {
  const playlistPath = path.join(outputDir, `${rendition.name}.m3u8`);
  const segmentPattern = path.join(outputDir, `segment_${rendition.name}_%03d.ts`);

  const args = [
    '-i', videoPath,
    // Video codec settings
    '-c:v', 'libx264',
    '-b:v', rendition.videoBitrate,
    '-s', rendition.resolution,
    '-preset', 'medium',
    // Audio codec settings
    '-c:a', 'aac',
    '-b:a', rendition.audioBitrate,
    // HLS settings
    '-f', 'hls',
    '-hls_time', String(segmentDuration),
    '-hls_list_size', '0',
    '-hls_segment_filename', segmentPattern,
    // Overwrite output
    '-y',
    playlistPath,
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[HLS] Rendition ${rendition.name} transcoded successfully`);
        resolve();
      } else {
        reject(new Error(`FFmpeg failed for rendition ${rendition.name} with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg for rendition ${rendition.name}: ${err.message}`));
    });
  });
}

/**
 * Create master playlist that references all rendition playlists
 *
 * @param outputDir - Directory containing rendition playlists
 * @param renditions - List of rendition configurations
 * @throws Error if master playlist cannot be created
 */
async function createMasterPlaylist(
  outputDir: string,
  renditions: HLSRendition[]
): Promise<void> {
  const masterPlaylistPath = path.join(outputDir, 'master.m3u8');

  let playlist = '#EXTM3U\n';
  playlist += '#EXT-X-VERSION:3\n\n';

  for (const rendition of renditions) {
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.resolution}\n`;
    playlist += `${rendition.name}.m3u8\n`;
  }

  await writeFileAtomically(masterPlaylistPath, playlist);
  console.log('[HLS] Master playlist created');
}

/**
 * Write file atomically (write to temp file then rename)
 */
async function writeFileAtomically(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await import('node:fs/promises').then(({ writeFile }) => writeFile(tempPath, content));
  await import('node:fs/promises').then(({ rename }) => rename(tempPath, filePath));
}

/**
 * Transcode video to HLS format with multiple quality renditions
 *
 * Creates:
 * - master.m3u8 (master playlist with all renditions)
 * - {rendition}.m3u8 (individual rendition playlists)
 * - segment_{rendition}_{number}.ts (segment files)
 *
 * @param videoPath - Full path to the input video file
 * @param options - Transcoding options
 * @returns Path to the master playlist
 * @throws Error if FFmpeg fails or video file doesn't exist
 */
export async function transcodeToHLS(
  videoPath: string,
  options: Partial<HLSTranscodeOptions> = {}
): Promise<string> {
  // Validate input video exists
  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const outputDir = getHLSOutputDir(videoPath);
  const segmentDuration = opts.segmentDuration!;
  const renditions = opts.renditions!;

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  console.log(`[HLS] Starting transcoding for ${videoPath}`);
  console.log(`[HLS] Output directory: ${outputDir}`);
  console.log(`[HLS] Renditions: ${renditions.map(r => r.name).join(', ')}`);

  // Transcode each rendition
  for (const rendition of renditions) {
    await transcodeRendition(videoPath, outputDir, rendition, segmentDuration);
  }

  // Create master playlist
  await createMasterPlaylist(outputDir, renditions);

  const masterPlaylistPath = getMasterPlaylistPath(videoPath);
  console.log(`[HLS] Transcoding complete: ${masterPlaylistPath}`);

  return masterPlaylistPath;
}

/**
 * Clean up HLS files for a video
 *
 * @param videoPath - Path to the original video file
 * @returns Promise that resolves when cleanup is complete
 */
export async function cleanupHLSFiles(videoPath: string): Promise<void> {
  const outputDir = getHLSOutputDir(videoPath);

  if (!existsSync(outputDir)) {
    return;
  }

  await rm(outputDir, { recursive: true, force: true });
  console.log(`[HLS] Cleaned up HLS files: ${outputDir}`);
}

/**
 * Get HLS transcoding status
 *
 * @param videoPath - Path to the original video file
 * @returns Status object with completion and file info
 */
export async function getHLSStatus(videoPath: string): Promise<{
  isComplete: boolean;
  masterPlaylistPath: string;
  outputDir: string;
}> {
  const masterPlaylistPath = getMasterPlaylistPath(videoPath);
  const outputDir = getHLSOutputDir(videoPath);

  return {
    isComplete: existsSync(masterPlaylistPath),
    masterPlaylistPath,
    outputDir,
  };
}

