/**
 * Whisper Models API Client
 * Handles fetching model status
 * Note: Models are auto-downloaded by nodejs-whisper on first transcription
 */

import { getApiUrl } from '../lib/config';

export interface WhisperModel {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  sizeFormatted: string;
  downloaded: boolean;
}

export interface WhisperModelsResponse {
  models: WhisperModel[];
}

/**
 * Get all available Whisper models with their download status
 */
export async function getWhisperModels(): Promise<WhisperModelsResponse> {
  const response = await fetch(`${getApiUrl()}/api/whisper-models`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to get models');
  }

  return response.json();
}

/**
 * Get status of a specific model
 */
export async function getModelStatus(modelId: string): Promise<WhisperModel> {
  const response = await fetch(
    `${getApiUrl()}/api/whisper-models/${encodeURIComponent(modelId)}/status`,
    {
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to get model status');
  }

  return response.json();
}
