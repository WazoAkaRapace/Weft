/**
 * React hook for video recording with chunked upload to backend
 *
 * Provides methods for starting, stopping, pausing, and canceling video recordings
 * with automatic chunked uploads to the server (every 30 seconds).
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
  DEFAULT_DURATION_INTERVAL,
  DEFAULT_TIMESLICE,
  DEFAULT_VIDEO_BITRATE,
} from '@weft/shared';
import {
  getPreferredCodecForBrowser,
  createVideoStreamerError,
  formatDuration,
  formatBytes,
} from '../lib/video-stream';
import { getApiUrl } from '../lib/config';

// Chunk upload interval (30 seconds)
const CHUNK_UPLOAD_INTERVAL = 30000;

/**
 * Options for useVideoStreamer hook
 */
export interface UseVideoStreamerOptions extends Partial<SharedVideoStreamerOptions> {
  /**
   * Preferred video codec (defaults to browser-preferred codec)
   */
  preferredCodec?: VideoCodec;

  /**
   * Specific video input device ID
   */
  videoDeviceId?: string;

  /**
   * Specific audio input device ID
   */
  audioDeviceId?: string;

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
  mediaStream: MediaStream | null;

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
    videoDeviceId,
    audioDeviceId,
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
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Refs for non-state values
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chunkUploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalBytesUploadedRef = useRef(0);
  const streamIdRef = useRef<string | null>(null);
  const codecRef = useRef<VideoCodec | null>(null);
  const chunkIndexRef = useRef(0);

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

    // Clear chunk upload interval
    if (chunkUploadIntervalRef.current) {
      clearInterval(chunkUploadIntervalRef.current);
      chunkUploadIntervalRef.current = null;
    }

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
    setMediaStream(null);
    totalBytesUploadedRef.current = 0;
    startTimeRef.current = null;
    streamIdRef.current = null;
    codecRef.current = null;
    chunkIndexRef.current = 0;
  }, [stopDurationTracking]);

  /**
   * Upload a single chunk to the server
   */
  const uploadChunk = useCallback(async (
    streamId: string,
    codec: VideoCodec,
    chunkBlob: Blob,
    index: number,
    isLast: boolean
  ): Promise<void> => {
    try {
      const response = await fetch(`${getApiUrl()}/api/journals/stream/chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': codec,
          'X-Stream-ID': streamId,
          'X-Chunk-Index': String(index),
          'X-Is-Last': isLast ? 'true' : 'false',
        },
        body: chunkBlob,
        credentials: 'include',
      });

      if (!response.ok) {
        throw createVideoStreamerError(
          `Chunk upload failed: ${response.status} ${response.statusText}`,
          'SERVER_ERROR'
        );
      }

      const result = (await response.json()) as {
        streamId: string;
        journalId?: string;
        videoPath?: string;
        duration?: number;
        isLast: boolean;
      };

      // Update bytes uploaded
      if (chunkBlob.size) {
        totalBytesUploadedRef.current += chunkBlob.size;
        setBytesUploaded(totalBytesUploadedRef.current);
        onProgress?.(totalBytesUploadedRef.current, duration);
      }

      // If this was the last chunk, trigger completion
      if (isLast && result.journalId) {
        onComplete?.({
          streamId: result.streamId,
          journalId: result.journalId,
          videoPath: result.videoPath || '',
          duration: result.duration || 0,
        } as StreamCompleteResponse);
        setState('completed');
      }
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        throw createVideoStreamerError('Chunk upload was canceled', 'STREAM_ERROR');
      }
      throw createVideoStreamerError(
        `Chunk upload error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        err instanceof Error ? err : undefined
      );
    }
  }, [duration, onProgress, onComplete, setState]);

  /**
   * Start periodic chunk uploads
   */
  const startChunkedUploads = useCallback(
    (initStreamId: string, codec: VideoCodec) => {
      setState('streaming');
      chunkIndexRef.current = 0;

      // Start interval to upload chunks every 30 seconds
      chunkUploadIntervalRef.current = setInterval(async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
          // Recording stopped, will be handled by stopRecording
          return;
        }

        // Collect all recorded chunks so far
        const chunks = [...recordedChunksRef.current];
        if (chunks.length === 0) {
          return;
        }

        // Combine chunks into a single blob for this upload
        const combinedBlob = new Blob(chunks, { type: codec });

        try {
          await uploadChunk(initStreamId, codec, combinedBlob, chunkIndexRef.current, false);

          // Clear chunks after successful upload
          recordedChunksRef.current = [];
          chunkIndexRef.current++;
        } catch (err) {
          console.error('Chunk upload failed:', err);
          // Don't stop recording on chunk upload failure, try again next interval
        }
      }, CHUNK_UPLOAD_INTERVAL);
    },
    [uploadChunk, setState]
  );

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Build video constraints with optional device ID
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      if (videoDeviceId) {
        videoConstraints.deviceId = { exact: videoDeviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      // Build audio constraints with optional device ID
      const audioConstraints: MediaTrackConstraints | boolean = audioDeviceId
        ? { deviceId: { exact: audioDeviceId } }
        : true;

      // Request camera/microphone permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      mediaStreamRef.current = mediaStream;
      setMediaStream(mediaStream);
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
        // Clear interval
        if (chunkUploadIntervalRef.current) {
          clearInterval(chunkUploadIntervalRef.current);
          chunkUploadIntervalRef.current = null;
        }
        stopDurationTracking();
      };

      mediaRecorderRef.current = mediaRecorder;

      // Initialize stream on server
      const initResponse = await fetch(`${getApiUrl()}/api/journals/stream/init`, {
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

      // Start periodic chunk uploads
      startChunkedUploads(initResult.streamId, codec);
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
    videoDeviceId,
    audioDeviceId,
    setState,
    handleError,
    cleanup,
    startChunkedUploads,
    startDurationTracking,
    stopDurationTracking,
  ]);

  /**
   * Stop recording and upload final chunk
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

    // Stop the chunk upload interval
    if (chunkUploadIntervalRef.current) {
      clearInterval(chunkUploadIntervalRef.current);
      chunkUploadIntervalRef.current = null;
    }

    // Get remaining chunks and codec
    const chunks = recordedChunksRef.current;
    const codec = codecRef.current;
    const streamId = streamIdRef.current;

    if (!codec || !streamId) {
      handleError(createVideoStreamerError('No stream ID or codec', 'STREAM_ERROR'));
      cleanup();
      return null;
    }

    try {
      // Upload final chunk with isLast=true
      if (chunks.length > 0) {
        const finalBlob = new Blob(chunks, { type: codec });
        await uploadChunk(streamId, codec, finalBlob, chunkIndexRef.current, true);

        // Wait a moment for server processing
        await new Promise(resolve => setTimeout(resolve, 500));

        cleanup();
        return {
          streamId,
          journalId: 'pending',
          videoPath: '',
          duration: duration,
        } as StreamCompleteResponse;
      }

      // No chunks to upload, but we still had a valid stream
      cleanup();
      return null;
    } catch (err) {
      handleError(err instanceof Error ? err : createVideoStreamerError('Failed to upload final chunk', 'NETWORK_ERROR'));
      cleanup();
      return null;
    }
  }, [setState, cleanup, uploadChunk, handleError, duration]);

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

    // Stop chunk upload interval
    if (chunkUploadIntervalRef.current) {
      clearInterval(chunkUploadIntervalRef.current);
      chunkUploadIntervalRef.current = null;
    }

    // Abort any pending chunk uploads
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
    mediaStream,

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

