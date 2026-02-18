/**
 * useAudioLevel Hook
 *
 * Analyzes audio levels from a MediaStream using Web Audio API.
 * Returns a normalized audio level (0-1) for visual feedback.
 */

import { useState, useEffect, useRef } from 'react';

interface UseAudioLevelOptions {
  /** MediaStream to analyze (should contain audio tracks) */
  mediaStream: MediaStream | null;
  /** Whether audio analysis is active */
  isActive: boolean;
  /** Smoothing factor (0-1, higher = smoother) */
  smoothing?: number;
}

interface UseAudioLevelReturn {
  /** Normalized audio level (0-1) */
  audioLevel: number;
}

export function useAudioLevel({
  mediaStream,
  isActive,
  smoothing = 0.8,
}: UseAudioLevelOptions): UseAudioLevelReturn {
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for AudioContext and related nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);
  const smoothingRef = useRef(smoothing);

  // Keep smoothing ref updated
  useEffect(() => {
    smoothingRef.current = smoothing;
  }, [smoothing]);

  // Setup audio analysis when active and stream is available
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      smoothedLevelRef.current = 0;
      setAudioLevel(0);
    };

    if (!isActive || !mediaStream) {
      cleanup();
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    // Create AudioContext
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // Create AnalyserNode
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = smoothingRef.current;
    analyserRef.current = analyser;

    // Create source from media stream
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    sourceRef.current = source;

    // Analysis function
    const analyze = () => {
      if (!analyserRef.current) return;

      const currentAnalyser = analyserRef.current;
      const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);
      currentAnalyser.getByteFrequencyData(dataArray);

      // Calculate RMS (root mean square) for more accurate level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Normalize to 0-1 range (255 is max byte value)
      const normalizedLevel = rms / 255;

      // Apply exponential smoothing for stable visual output
      smoothedLevelRef.current =
        smoothedLevelRef.current * smoothingRef.current +
        normalizedLevel * (1 - smoothingRef.current);

      setAudioLevel(smoothedLevelRef.current);

      // Continue analysis loop
      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    // Start analysis loop
    animationFrameRef.current = requestAnimationFrame(analyze);

    return cleanup;
  }, [isActive, mediaStream]);

  return { audioLevel };
}
