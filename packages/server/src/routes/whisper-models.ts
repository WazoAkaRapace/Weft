/**
 * Whisper Models API Routes
 * Handles model listing, download status, and model downloads
 */

import {
  getAllModelStatuses,
  getModelById,
  downloadModel,
  isModelDownloaded,
  isModelDownloading,
  getDownloadProgress,
  cancelDownload,
  deleteModel,
  getTotalDownloadedSize,
} from '../services/whisper-models.js';

/**
 * Get all available models with their download status
 * GET /api/whisper-models
 */
export async function handleGetWhisperModels(): Promise<Response> {
  try {
    const models = getAllModelStatuses();
    const totalSize = await getTotalDownloadedSize();

    return Response.json({
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sizeBytes: m.sizeBytes,
        sizeFormatted: formatBytes(m.sizeBytes),
        downloaded: m.downloaded,
        downloading: m.downloading,
        progress: m.progress,
      })),
      totalDownloadedSize: totalSize,
      totalDownloadedSizeFormatted: formatBytes(totalSize),
    });
  } catch (error) {
    console.error('[WhisperModels] Error getting models:', error);
    return Response.json(
      { error: 'Failed to get models', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Get status of a specific model
 * GET /api/whisper-models/:modelId/status
 */
export async function handleGetModelStatus(_request: Request, modelId: string): Promise<Response> {
  try {
    // Decode the modelId (it may be URL-encoded)
    const decodedModelId = decodeURIComponent(modelId);

    const model = getModelById(decodedModelId);
    if (!model) {
      return Response.json(
        { error: 'Model not found', message: `Unknown model: ${decodedModelId}` },
        { status: 404 }
      );
    }

    return Response.json({
      id: model.id,
      name: model.name,
      description: model.description,
      sizeBytes: model.sizeBytes,
      sizeFormatted: formatBytes(model.sizeBytes),
      downloaded: isModelDownloaded(model.filename),
      downloading: isModelDownloading(model.id),
      progress: getDownloadProgress(model.id),
    });
  } catch (error) {
    console.error('[WhisperModels] Error getting model status:', error);
    return Response.json(
      { error: 'Failed to get model status', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Download a model
 * POST /api/whisper-models/:modelId/download
 */
export async function handleDownloadModel(_request: Request, modelId: string): Promise<Response> {
  try {
    // Decode the modelId (it may be URL-encoded)
    const decodedModelId = decodeURIComponent(modelId);

    const model = getModelById(decodedModelId);
    if (!model) {
      return Response.json(
        { error: 'Model not found', message: `Unknown model: ${decodedModelId}` },
        { status: 404 }
      );
    }

    // Check if already downloaded
    if (isModelDownloaded(model.filename)) {
      return Response.json({
        success: true,
        message: 'Model already downloaded',
        model: {
          id: model.id,
          downloaded: true,
        },
      });
    }

    // Check if already downloading
    if (isModelDownloading(model.id)) {
      return Response.json({
        success: true,
        message: 'Model is already being downloaded',
        model: {
          id: model.id,
          downloading: true,
          progress: getDownloadProgress(model.id),
        },
      });
    }

    // Start download in background
    downloadModel(model.id).catch(error => {
      console.error(`[WhisperModels] Background download failed for ${model.id}:`, error);
    });

    return Response.json({
      success: true,
      message: 'Download started',
      model: {
        id: model.id,
        downloading: true,
        progress: 0,
      },
    });
  } catch (error) {
    console.error('[WhisperModels] Error starting download:', error);
    return Response.json(
      { error: 'Failed to start download', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Cancel a model download
 * DELETE /api/whisper-models/:modelId/download
 */
export async function handleCancelDownload(_request: Request, modelId: string): Promise<Response> {
  try {
    const decodedModelId = decodeURIComponent(modelId);

    const model = getModelById(decodedModelId);
    if (!model) {
      return Response.json(
        { error: 'Model not found', message: `Unknown model: ${decodedModelId}` },
        { status: 404 }
      );
    }

    const cancelled = cancelDownload(model.id);

    return Response.json({
      success: cancelled,
      message: cancelled ? 'Download cancelled' : 'No active download to cancel',
    });
  } catch (error) {
    console.error('[WhisperModels] Error cancelling download:', error);
    return Response.json(
      { error: 'Failed to cancel download', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Delete a downloaded model
 * DELETE /api/whisper-models/:modelId
 */
export async function handleDeleteModel(_request: Request, modelId: string): Promise<Response> {
  try {
    const decodedModelId = decodeURIComponent(modelId);

    const model = getModelById(decodedModelId);
    if (!model) {
      return Response.json(
        { error: 'Model not found', message: `Unknown model: ${decodedModelId}` },
        { status: 404 }
      );
    }

    const deleted = await deleteModel(model.id);

    return Response.json({
      success: deleted,
      message: deleted ? 'Model deleted' : 'Model was not downloaded',
    });
  } catch (error) {
    console.error('[WhisperModels] Error deleting model:', error);
    return Response.json(
      { error: 'Failed to delete model', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
