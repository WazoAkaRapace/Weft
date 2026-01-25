/**
 * Video streaming types shared between server and client
 */

/**
 * Video codec types supported by the application
 */
export type VideoCodec =
  | 'video/webm;codecs=vp9'
  | 'video/webm;codecs=vp8'
  | 'video/mp4;codecs=h264'
  | 'video/webm';

/**
 * Recording states for the video streamer
 */
export type RecordingState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'streaming'
  | 'completed'
  | 'error';

/**
 * Error codes for video streaming
 */
export type VideoStreamerErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_CODEC'
  | 'STREAM_ERROR'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

/**
 * Initial stream response from server
 */
export interface StreamInitResponse {
  streamId: string;
  uploadUrl: string;
}

/**
 * Final stream completion response
 */
export interface StreamCompleteResponse {
  streamId: string;
  journalId: string;
  videoPath: string;
  duration: number;
}

/**
 * Stream error response
 */
export interface StreamErrorResponse {
  streamId: string;
  error: string;
  code: VideoStreamerErrorCode;
}

/**
 * Video metadata
 */
export interface VideoMetadata {
  duration: number;
  codec: VideoCodec;
  mimeType: string;
  size: number;
}

/**
 * Browser capabilities for video recording
 */
export interface BrowserCapabilities {
  mediaRecorder: boolean;
  mediaStream: boolean;
  readableStream: boolean;
  getUserMedia: boolean;
  supportedCodecs: VideoCodec[];
}

/**
 * Journal creation payload
 */
export interface CreateJournalPayload {
  title: string;
  videoPath: string;
  duration: number;
  location?: string;
  notes?: string;
}

/**
 * Stream status updates from server
 */
export interface StreamStatusUpdate {
  streamId: string;
  status: 'receiving' | 'processing' | 'completed' | 'error';
  bytesReceived: number;
  error?: string;
}

/**
 * Video streamer options
 */
export interface VideoStreamerOptions {
  preferredCodec?: VideoCodec;
  chunkSize?: number;
  durationUpdateInterval?: number;
  onProgress?: (bytesUploaded: number, duration: number) => void;
  onStateChange?: (state: RecordingState) => void;
  onError?: (error: Error) => void;
}

/**
 * Video streamer state
 */
export interface VideoStreamerState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  bytesUploaded: number;
  error: Error | null;
  streamId: string | null;
  recordingState: RecordingState;
}

/**
 * Custom error class for video streaming errors
 */
export class VideoStreamerError extends Error {
  constructor(
    message: string,
    public code: VideoStreamerErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'VideoStreamerError';
  }
}

/**
 * All supported codecs in order of preference
 */
export const CODEC_PREFERENCE: VideoCodec[] = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/mp4;codecs=h264',
  'video/webm',
];

/**
 * Default MIME type for video recording
 */
export const DEFAULT_MIME_TYPE = 'video/webm';

/**
 * Default video bitrate (2.5 Mbps)
 */
export const DEFAULT_VIDEO_BITRATE = 2_500_000;

/**
 * Default chunk size for streaming (64KB)
 */
export const DEFAULT_CHUNK_SIZE = 64 * 1024;

/**
 * Default duration update interval (100ms)
 */
export const DEFAULT_DURATION_INTERVAL = 100;

/**
 * Default MediaRecorder timeslice (1 second)
 */
export const DEFAULT_TIMESLICE = 1000;

/**
 * Default video constraints for getUserMedia (browser-side only)
 */
export interface VideoConstraints {
  width: { ideal: number };
  height: { ideal: number };
  facingMode: string;
}

/**
 * Default video constraints for getUserMedia
 * Note: Use this on the browser side where MediaTrackConstraints is available
 */
export const DEFAULT_VIDEO_CONSTRAINTS: VideoConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};
