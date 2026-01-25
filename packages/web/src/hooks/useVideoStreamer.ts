/**
 * React hook for video recording with upload to backend
 *
 * Provides methods for starting, stopping, pausing, and canceling video recordings
 * with automatic upload to the server after recording stops.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  RecordingState,
  StreamInitResponse,
  StreamCompleteResponse,
  VideoCodec,
  VideoStreamerOptions as SharedVideoStreamerOptions,
  VideoStreamerError,
} from '@weft/shared';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_DURATION_INTERVAL,
  DEFAULT_MIME_TYPE,
  DEFAULT_TIMESLICE,
  DEFAULT_VIDEO_BITRATE,
  VideoStreamerError as VideoStreamerErrorClass,
} from '@weft/shared';
import {
  detectSupportedCodec,
  getPreferredCodecForBrowser,
  createVideoStreamerError,
  formatDuration,
  formatBytes,
} from '../lib/video-stream';

// API base URL from environment or default
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Options for useVideoStreamer hook
 */
export interface UseVideoStreamerOptions extends Partial<SharedVideoStreamerOptions> {
  /**
   * Preferred video codec (defaults to browser-preferred codec)
   */
  preferredCodec?: VideoCodec;

  /**
   * Chunk size for streaming in bytes (default: 64KB)
   */
  chunkSize?: number;

  /**
   * Interval for duration updates in ms (default: 100ms)
   */
  durationUpdateInterval?: number;

  /**
   * Callback for stream progress updates
   */
  onProgress?: (bytesUploaded: number, duration: number) => void;

  /**
   * Callback for recording state changes
   */
  onStateChange?: (state: RecordingState) => void;

  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;

  /**
   * Callback for recording completion
   */
  onComplete?: (result: StreamCompleteResponse) => void;
}

/**
 * Return type for useVideoStreamer hook
 */
export interface UseVideoStreamerReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  bytesUploaded: number;
  error: Error | null;
  streamId: string | null;
  recordingState: RecordingState;
  selectedCodec: VideoCodec | null;

  // Methods
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<StreamCompleteResponse | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => Promise<void>;

  // Utilities
  getSupportedCodecs: () => VideoCodec[];
  getSelectedCodec: () => VideoCodec | null;
  formatDuration: (seconds: number) => string;
  formatBytes: (bytes: number) => string;
}

/**
 * React hook for video recording with streaming to backend
 *
 * @example
 * ```tsx
 * const { isRecording, duration, startRecording, stopRecording } = useVideoStreamer();
 *
 * return (
 *   <div>
 *     <button onClick={startRecording} disabled={isRecording}>
 *       Start Recording
 *     </button>
 *     {isRecording && (
 *       <div>Duration: {duration}s</div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useVideoStreamer(options: UseVideoStreamerOptions = {}): UseVideoStreamerReturn {
  const {
    preferredCodec,
    chunkSize = DEFAULT_CHUNK_SIZE,
    durationUpdateInterval = DEFAULT_DURATION_INTERVAL,
    onProgress,
    onStateChange,
    onError,
    onComplete,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [selectedCodec, setSelectedCodec] = useState<VideoCodec | null>(null);

  // Refs for non-state values
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const codecRef = useRef<VideoCodec | null>(null);

  /**
   * Update recording state and trigger callback
   */
  const setState = useCallback(
    (newState: RecordingState) => {
      setRecordingState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  /**
   * Handle errors
   */
  const handleError = useCallback(
    (err: Error | VideoStreamerError) => {
      setError(err);
      setState('error');
      onError?.(err);
    },
    [onError, setState]
  );

  /**
   * Start duration tracking
   */
  const startDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    startTimeRef.current = Date.now();

    durationIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const newDuration = Math.round(elapsed * 100) / 100;
        setDuration(newDuration);
      }
    }, durationUpdateInterval);
  }, [durationUpdateInterval]);

  /**
   * Stop duration tracking
   */
  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Stop all media tracks
    mediaStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    // Clear references
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    recordedChunksRef.current = [];
    abortControllerRef.current = null;

    // Stop duration tracking
    stopDurationTracking();

    // Reset state
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setBytesUploaded(0);
    setStreamId(null);
    setSelectedCodec(null);
    streamIdRef.current = null;
    codecRef.current = null;
    startTimeRef.current = null;
  }, [stopDurationTracking]);

  /**
   * Upload recorded video to the server
   */
  const uploadRecording = useCallback(
    async (initStreamId: string, codec: VideoCodec, chunks: Blob[]): Promise<StreamCompleteResponse> => {
      abortControllerRef.current = new AbortController();

      // Combine chunks into a single blob
      const blob = new Blob(chunks, { type: codec });
      const totalBytes = blob.size;

      try {
        // Simulate upload progress
        let uploadedBytes = 0;
        const progressInterval = setInterval(() => {
          if (uploadedBytes < totalBytes) {
            uploadedBytes = Math.min(uploadedBytes + Math.floor(totalBytes / 10), totalBytes);
            setBytesUploaded(uploadedBytes);
            onProgress?.(uploadedBytes, duration);
          }
        }, 100);

        const response = await fetch(`${API_BASE}/api/journals/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': codec,
            'X-Stream-ID': initStreamId,
          },
          body: blob,
          signal: abortControllerRef.current.signal,
          credentials: 'include',
        });

        clearInterval(progressInterval);
        setBytesUploaded(totalBytes);
        onProgress?.(totalBytes, duration);

        if (!response.ok) {
          const errorText = await response.text();
          throw createVideoStreamerError(
            `Stream upload failed: ${response.status} ${response.statusText}`,
            'SERVER_ERROR'
          );
        }

        const result = (await response.json()) as StreamCompleteResponse;
        return result;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw createVideoStreamerError('Stream upload was canceled', 'STREAM_ERROR');
        }
        throw createVideoStreamerError(
          `Stream upload error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'NETWORK_ERROR',
          err instanceof Error ? err : undefined
        );
      }
    },
    [API_BASE, duration, onProgress]
  );

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request camera/microphone permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      mediaStreamRef.current = mediaStream;
      setIsRecording(true);
      setState('recording');

      // Detect codec
      const codec = preferredCodec || getPreferredCodecForBrowser();
      if (!codec) {
        throw createVideoStreamerError(
          'Browser does not support any compatible video codecs',
          'NO_CODEC'
        );
      }
      setSelectedCodec(codec);
      codecRef.current = codec;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: codec,
        videoBitsPerSecond: DEFAULT_VIDEO_BITRATE,
      });

      // Set up dataavailable handler - accumulate chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle recorder errors
      mediaRecorder.onerror = (event) => {
        const err = createVideoStreamerError(
          `MediaRecorder error: ${event}`,
          'STREAM_ERROR'
        );
        handleError(err);
        cleanup();
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        stopDurationTracking();
      };

      mediaRecorderRef.current = mediaRecorder;

      // Initialize stream on server
      const initResponse = await fetch(`${API_BASE}/api/journals/stream/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!initResponse.ok) {
        throw createVideoStreamerError(
          'Failed to initialize stream on server',
          'SERVER_ERROR'
        );
      }

      const initResult = (await initResponse.json()) as StreamInitResponse;
      setStreamId(initResult.streamId);
      streamIdRef.current = initResult.streamId;

      // Start recording with timeslice for chunking
      mediaRecorder.start(DEFAULT_TIMESLICE);

      // Start duration tracking
      startDurationTracking();
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : createVideoStreamerError('Unknown error starting recording', 'STREAM_ERROR');

      // Handle permission errors
      if (error.name === 'NotAllowedError') {
        const permissionError = createVideoStreamerError(
          'Camera/microphone permission denied',
          'PERMISSION_DENIED',
          error
        );
        handleError(permissionError);
      } else {
        handleError(error);
      }

      cleanup();
    }
  }, [
    preferredCodec,
    setState,
    handleError,
    cleanup,
    startDurationTracking,
    stopDurationTracking,
    API_BASE,
  ]);

  /**
   * Stop recording and upload
   */
  const stopRecording = useCallback(async (): Promise<StreamCompleteResponse | null> => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return null;
    }

    setState('streaming');
    setIsRecording(false);
    setIsPaused(false);

    // Stop MediaRecorder
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Wait a moment for all chunks to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get recorded chunks and codec
    const chunks = recordedChunksRef.current;
    const codec = codecRef.current;
    const streamId = streamIdRef.current;

    if (!codec || !streamId || chunks.length === 0) {
      handleError(createVideoStreamerError('No video data recorded', 'STREAM_ERROR'));
      cleanup();
      return null;
    }

    try {
      // Upload the recording
      const result = await uploadRecording(streamId, codec, chunks);
      onComplete?.(result);
      setState('completed');
      cleanup();
      return result;
    } catch (err) {
      handleError(err instanceof Error ? err : createVideoStreamerError('Upload failed', 'NETWORK_ERROR'));
      cleanup();
      return null;
    }
  }, [setState, cleanup, uploadRecording, handleError, onComplete]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopDurationTracking();
    }
  }, [stopDurationTracking]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startDurationTracking();
    }
  }, [startDurationTracking]);

  /**
   * Cancel recording and cleanup
   */
  const cancelRecording = useCallback(async () => {
    setState('idle');

    // Abort upload if in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    cleanup();
  }, [setState, cleanup]);

  /**
   * Get supported codecs
   */
  const getSupportedCodecs = useCallback((): VideoCodec[] => {
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
  }, []);

  /**
   * Get selected codec
   */
  const getSelectedCodec = useCallback((): VideoCodec | null => {
    return selectedCodec;
  }, [selectedCodec]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      abortControllerRef.current?.abort();
    };
  }, [cleanup]);

  return {
    // State
    isRecording,
    isPaused,
    duration,
    bytesUploaded,
    error,
    streamId,
    recordingState,
    selectedCodec,

    // Methods
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,

    // Utilities
    getSupportedCodecs,
    getSelectedCodec,
    formatDuration,
    formatBytes,
  };
}

export default useVideoStreamer;
