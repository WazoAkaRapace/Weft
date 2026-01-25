/**
 * Video streaming utilities for codec detection, browser capability detection,
 * and stream helper functions.
 */

import type {
  VideoCodec,
  BrowserCapabilities,
  VideoStreamerError,
  VideoStreamerErrorCode,
  CODEC_PREFERENCE,
} from '@weft/shared';

/**
 * Detect the best supported video codec for the current browser
 *
 * Checks codecs in order of preference: VP9 → VP8 → H.264 → fallback
 *
 * @returns The best supported codec or null if none are supported
 */
export function detectSupportedCodec(): VideoCodec | null {
  // Early return if MediaRecorder is not supported
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  const codecs: VideoCodec[] = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/mp4;codecs=h264',
    'video/webm',
  ];

  for (const codec of codecs) {
    try {
      if (MediaRecorder.isTypeSupported(codec)) {
        return codec;
      }
    } catch {
      // Some browsers throw errors for unsupported codecs
      continue;
    }
  }

  return null;
}

/**
 * Get all supported video codecs for the current browser
 *
 * @returns Array of supported codecs
 */
export function getSupportedCodecs(): VideoCodec[] {
  if (typeof MediaRecorder === 'undefined') {
    return [];
  }

  const codecs: VideoCodec[] = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/mp4;codecs=h264',
    'video/webm',
  ];

  return codecs.filter((codec) => {
    try {
      return MediaRecorder.isTypeSupported(codec);
    } catch {
      return false;
    }
  });
}

/**
 * Detect browser capabilities for video recording
 *
 * @returns Object containing browser capabilities
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  return {
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    mediaStream: typeof MediaStream !== 'undefined',
    readableStream: typeof ReadableStream !== 'undefined',
    getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
    supportedCodecs: getSupportedCodecs(),
  };
}

/**
 * Detect the current browser type
 *
 * @returns Browser name or 'Unknown'
 */
export function detectBrowser(): string {
  const ua = navigator.userAgent;

  if (ua.includes('Firefox')) {
    return 'Firefox';
  }
  if (ua.includes('Edg')) {
    return 'Edge';
  }
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    return 'Chrome';
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return 'Safari';
  }

  return 'Unknown';
}

/**
 * Get the preferred codec for the current browser
 *
 * @returns The preferred codec for the detected browser
 */
export function getPreferredCodecForBrowser(): VideoCodec | null {
  const browser = detectBrowser();
  const supported = getSupportedCodecs();

  // Browser-specific preferences
  const preferences: Record<string, VideoCodec[]> = {
    Chrome: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
    Firefox: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
    Safari: ['video/mp4;codecs=h264'],
    Edge: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
  };

  const browserPrefs = preferences[browser] || [];

  // Return first supported preference
  for (const codec of browserPrefs) {
    if (supported.includes(codec as VideoCodec)) {
      return codec as VideoCodec;
    }
  }

  // Fallback to first supported codec
  return supported[0] || null;
}

/**
 * Check if camera permission has been granted
 *
 * @returns Promise resolving to permission status
 */
export async function checkCameraPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions) {
    return null;
  }

  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch {
    return null;
  }
}

/**
 * Check if microphone permission has been granted
 *
 * @returns Promise resolving to permission status
 */
export async function checkMicrophonePermission(): Promise<PermissionState | null> {
  if (!navigator.permissions) {
    return null;
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state;
  } catch {
    return null;
  }
}

/**
 * Create a VideoStreamerError with the appropriate error code
 *
 * @param message - Error message
 * @param code - Error code
 * @param originalError - Original error that caused this error
 * @returns VideoStreamerError instance
 */
export function createVideoStreamerError(
  message: string,
  code: VideoStreamerErrorCode,
  originalError?: Error
): VideoStreamerError {
  const error = new Error(message) as VideoStreamerError;
  error.name = 'VideoStreamerError';
  error.code = code;
  error.originalError = originalError;
  return error;
}

/**
 * Class for managing a queue of media chunks for streaming
 */
export class MediaChunkQueue {
  private chunks: Blob[] = [];
  private isStreaming = true;
  private pendingResolve: ((value: Blob | null) => void) | null = null;

  /**
   * Add a chunk to the queue
   */
  enqueue(chunk: Blob): void {
    this.chunks.push(chunk);

    // If there's a pending pull, resolve it
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(this.chunks.shift() || null);
    }
  }

  /**
   * Get the next chunk from the queue
   */
  async dequeue(): Promise<Blob | null> {
    // If there's a chunk available, return it immediately
    if (this.chunks.length > 0) {
      return this.chunks.shift() || null;
    }

    // If streaming is done and no chunks left, return null to signal end
    if (!this.isStreaming) {
      return null;
    }

    // Wait for a chunk to be added
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  /**
   * Signal that streaming is complete
   */
  close(): void {
    this.isStreaming = false;

    // If there's a pending pull, resolve it with null
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(null);
    }
  }

  /**
   * Clear all chunks and reset state
   */
  clear(): void {
    this.chunks = [];
    this.isStreaming = true;
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(null);
    }
  }

  /**
   * Get the current queue size
   */
  get size(): number {
    return this.chunks.length;
  }

  /**
   * Check if streaming is active
   */
  get active(): boolean {
    return this.isStreaming;
  }
}

/**
 * Format duration in seconds to a readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1:23", "1:00:00")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bytes to a readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted bytes string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Check if the current environment supports all required features
 *
 * @returns true if all features are supported, false otherwise
 */
export function isVideoStreamingSupported(): boolean {
  const capabilities = detectBrowserCapabilities();
  return (
    capabilities.mediaRecorder &&
    capabilities.mediaStream &&
    capabilities.readableStream &&
    capabilities.getUserMedia &&
    capabilities.supportedCodecs.length > 0
  );
}

/**
 * Get a detailed support status message
 *
 * @returns Object with support status and message
 */
export function getSupportStatus(): { supported: boolean; message: string } {
  const capabilities = detectBrowserCapabilities();

  if (!capabilities.mediaRecorder) {
    return {
      supported: false,
      message: 'MediaRecorder is not supported in this browser',
    };
  }

  if (!capabilities.getUserMedia) {
    return {
      supported: false,
      message: 'getUserMedia is not supported in this browser',
    };
  }

  if (!capabilities.readableStream) {
    return {
      supported: false,
      message: 'ReadableStream is not supported in this browser',
    };
  }

  if (capabilities.supportedCodecs.length === 0) {
    return {
      supported: false,
      message: 'No supported video codecs found in this browser',
    };
  }

  return {
    supported: true,
    message: `Video streaming is supported. Available codecs: ${capabilities.supportedCodecs.join(', ')}`,
  };
}
