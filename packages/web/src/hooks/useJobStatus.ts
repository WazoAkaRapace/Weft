/**
 * Custom hook for polling job status (transcription, emotion detection)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '../lib/config';

export type JobStatusType = 'pending' | 'processing' | 'completed' | 'failed' | null;

export interface JobStatus {
  status: JobStatusType;
  error?: string;
}

export interface JobsStatus {
  transcription: JobStatus;
  emotion: JobStatus;
}

export interface UseJobStatusResult {
  jobStatus: JobsStatus;
  isLoading: boolean;
  error: Error | null;
  retryTranscription: () => Promise<void>;
  retryEmotion: () => Promise<void>;
  isRetryingTranscription: boolean;
  isRetryingEmotion: boolean;
}

export function useJobStatus(
  journalId: string,
  pollInterval: number = 5000
): UseJobStatusResult {
  const [jobStatus, setJobStatus] = useState<JobsStatus>({
    transcription: null,
    emotion: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRetryingTranscription, setIsRetryingTranscription] = useState(false);
  const [isRetryingEmotion, setIsRetryingEmotion] = useState(false);

  // Track whether we initiated a retry to prevent premature state reset
  const transcriptionRetryInProgressRef = useRef(false);
  const emotionRetryInProgressRef = useRef(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchJobStatus = useCallback(async () => {
    if (!journalId || !isMountedRef.current) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/journals/${journalId}/jobs`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }

      const result = await response.json();

      if (isMountedRef.current) {
        setJobStatus({
          transcription: result.transcription || null,
          emotion: result.emotion || null,
        });
        setIsLoading(false);
        setError(null);

        // Update retrying states based on job status
        // Only reset to false if we see a terminal state (completed or failed)
        const transStatus = result.transcription?.status;
        const emotionStatus = result.emotion?.status;

        // For transcription: keep retrying true only if actively processing/pending
        if (transStatus === 'processing' || transStatus === 'pending') {
          setIsRetryingTranscription(true);
        } else {
          setIsRetryingTranscription(false);
          transcriptionRetryInProgressRef.current = false;
        }

        // For emotion: keep retrying true only if actively processing/pending
        if (emotionStatus === 'processing' || emotionStatus === 'pending') {
          setIsRetryingEmotion(true);
        } else {
          setIsRetryingEmotion(false);
          emotionRetryInProgressRef.current = false;
        }

        // Check if both jobs are completed or not started
        const bothComplete =
          (!result.transcription || result.transcription.status === 'completed') &&
          (!result.emotion || result.emotion.status === 'completed');

        // Stop polling if both are complete and no retries are in progress
        if (bothComplete &&
            pollIntervalRef.current &&
            !transcriptionRetryInProgressRef.current &&
            !emotionRetryInProgressRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to fetch job status:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    }
  }, [journalId]);

  const startPolling = useCallback(() => {
    // Clear existing interval if any
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    // Start polling
    fetchJobStatus();
    pollIntervalRef.current = setInterval(fetchJobStatus, pollInterval);
  }, [fetchJobStatus, pollInterval]);

  const retryTranscription = useCallback(async () => {
    if (isRetryingTranscription) return;

    // Mark that we're initiating a retry
    transcriptionRetryInProgressRef.current = true;
    setIsRetryingTranscription(true);

    // Immediately update status to show processing
    setJobStatus(prev => ({
      ...prev,
      transcription: { status: 'pending' },
    }));

    try {
      const response = await fetch(`${getApiUrl()}/api/journals/${journalId}/transcription/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry transcription: ${response.statusText}`);
      }

      // Start/continue polling
      startPolling();
    } catch (err) {
      console.error('Failed to retry transcription:', err);
      // Reset status on error
      setIsRetryingTranscription(false);
      transcriptionRetryInProgressRef.current = false;
      throw err;
    }
    // Note: We keep isRetryingTranscription true until fetchJobStatus sees a terminal state
  }, [journalId, isRetryingTranscription, startPolling]);

  const retryEmotion = useCallback(async () => {
    if (isRetryingEmotion) return;

    // Mark that we're initiating a retry
    emotionRetryInProgressRef.current = true;
    setIsRetryingEmotion(true);

    // Immediately update status to show processing
    setJobStatus(prev => ({
      ...prev,
      emotion: { status: 'pending' },
    }));

    try {
      const response = await fetch(`${getApiUrl()}/api/journals/${journalId}/emotions/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retry emotion analysis: ${response.statusText}`);
      }

      // Start/continue polling
      startPolling();
    } catch (err) {
      console.error('Failed to retry emotion analysis:', err);
      // Reset status on error
      setIsRetryingEmotion(false);
      emotionRetryInProgressRef.current = false;
      throw err;
    }
    // Note: We keep isRetryingEmotion true until fetchJobStatus sees a terminal state
  }, [journalId, isRetryingEmotion, startPolling]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchJobStatus();

    // Start polling
    pollIntervalRef.current = setInterval(fetchJobStatus, pollInterval);

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchJobStatus, pollInterval]);

  return {
    jobStatus,
    isLoading,
    error,
    retryTranscription,
    retryEmotion,
    isRetryingTranscription,
    isRetryingEmotion,
  };
}
