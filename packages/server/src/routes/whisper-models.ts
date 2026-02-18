/**
 * Whisper Models API Routes
 * Handles model listing (downloads are automatic via nodejs-whisper)
 */

import { getAllModels, getModelById } from '../services/whisper-models.js';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Find the nodejs-whisper package's models directory
function getNodejsWhisperModelsDir(): string {
  try {
    const nodejsWhisperPath = require.resolve('nodejs-whisper/package.json');
    const packageDir = path.dirname(nodejsWhisperPath);
    return path.join(packageDir, 'cpp', 'whisper.cpp', 'models');
  } catch {
    return path.join(process.cwd(), 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp', 'models');
  }
}

import path from 'node:path';

const MODELS_DIR = getNodejsWhisperModelsDir();

/**
 * Check if a model is downloaded (exists in nodejs-whisper's models directory)
 */
function isModelDownloaded(filename: string): boolean {
  return existsSync(path.join(MODELS_DIR, filename));
}

/**
 * Get all available models with their download status
 * GET /api/whisper-models
 */
export async function handleGetWhisperModels(): Promise<Response> {
  try {
    const models = getAllModels();

    return Response.json({
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sizeBytes: m.sizeBytes,
        sizeFormatted: formatBytes(m.sizeBytes),
        downloaded: isModelDownloaded(m.filename),
      })),
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
 *
 * Note: With nodejs-whisper's autoDownloadModelName, models are downloaded
 * automatically on first use. This endpoint is kept for manual pre-fetching.
 */
export async function handleDownloadModel(_request: Request, modelId: string): Promise<Response> {
  try {
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

    // Models are now auto-downloaded by nodejs-whisper on first transcription
    // Inform the user to trigger a transcription to download the model
    return Response.json({
      success: true,
      message: 'Model will be downloaded automatically when you first use it for transcription',
      model: {
        id: model.id,
        downloaded: false,
        autoDownload: true,
      },
    });
  } catch (error) {
    console.error('[WhisperModels] Error with download request:', error);
    return Response.json(
      { error: 'Failed to process download request', message: (error as Error).message },
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
