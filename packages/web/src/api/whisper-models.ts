/**
 * Whisper Models API Client
 * Handles fetching model status and triggering downloads
 */

import { getApiUrl } from '../lib/config';

export interface WhisperModel {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  sizeFormatted: string;
  downloaded: boolean;
  downloading: boolean;
  progress: number | null;
}

export interface WhisperModelsResponse {
  models: WhisperModel[];
  totalDownloadedSize: number;
  totalDownloadedSizeFormatted: string;
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

/**
 * Start downloading a model
 */
export async function downloadWhisperModel(modelId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${getApiUrl()}/api/whisper-models/${encodeURIComponent(modelId)}/download`,
    {
      method: 'POST',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to start download');
  }

  return response.json();
}

/**
 * Cancel an active model download
 */
export async function cancelModelDownload(modelId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${getApiUrl()}/api/whisper-models/${encodeURIComponent(modelId)}/download`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to cancel download');
  }

  return response.json();
}

/**
 * Delete a downloaded model
 */
export async function deleteWhisperModel(modelId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${getApiUrl()}/api/whisper-models/${encodeURIComponent(modelId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete model');
  }

  return response.json();
}
