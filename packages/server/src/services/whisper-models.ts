/**
 * Whisper Model Download Service
 * Handles downloading and managing Whisper models from Hugging Face
 */

import { createWriteStream, existsSync, statSync, unlinkSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MODELS_DIR = process.env.WHISPER_MODELS_DIR || path.join(UPLOAD_DIR, 'whisper-models');

// Hugging Face base URL for whisper.cpp models
const HUGGINGFACE_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

// Model definitions with sizes and download info
export interface WhisperModel {
  id: string;           // Xenova format: Xenova/whisper-small
  filename: string;     // whisper.cpp format: ggml-small.bin
  name: string;         // Display name
  description: string;
  sizeBytes: number;    // Approximate file size
  downloadUrl: string;  // Full download URL
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'Xenova/whisper-tiny',
    filename: 'ggml-tiny.bin',
    name: 'Tiny (Multilingual)',
    description: 'Fastest, lowest accuracy. Best for quick drafts.',
    sizeBytes: 75 * 1024 * 1024, // ~75MB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-tiny.bin`,
  },
  {
    id: 'Xenova/whisper-tiny.en',
    filename: 'ggml-tiny.en.bin',
    name: 'Tiny (English-only)',
    description: 'Fastest for English. Slightly better accuracy than multilingual.',
    sizeBytes: 75 * 1024 * 1024,
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-tiny.en.bin`,
  },
  {
    id: 'Xenova/whisper-base',
    filename: 'ggml-base.bin',
    name: 'Base (Multilingual)',
    description: 'Balanced speed and accuracy. Good default option.',
    sizeBytes: 142 * 1024 * 1024, // ~142MB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-base.bin`,
  },
  {
    id: 'Xenova/whisper-base.en',
    filename: 'ggml-base.en.bin',
    name: 'Base (English-only)',
    description: 'Better accuracy for English than multilingual base.',
    sizeBytes: 142 * 1024 * 1024,
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-base.en.bin`,
  },
  {
    id: 'Xenova/whisper-small',
    filename: 'ggml-small.bin',
    name: 'Small (Multilingual)',
    description: 'Good accuracy, reasonable speed. Recommended for most users.',
    sizeBytes: 466 * 1024 * 1024, // ~466MB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-small.bin`,
  },
  {
    id: 'Xenova/whisper-small.en',
    filename: 'ggml-small.en.bin',
    name: 'Small (English-only)',
    description: 'Best accuracy for English at this size.',
    sizeBytes: 466 * 1024 * 1024,
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-small.en.bin`,
  },
  {
    id: 'Xenova/whisper-medium',
    filename: 'ggml-medium.bin',
    name: 'Medium (Multilingual)',
    description: 'High accuracy, slower processing. Good for important recordings.',
    sizeBytes: 1500 * 1024 * 1024, // ~1.5GB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-medium.bin`,
  },
  {
    id: 'Xenova/whisper-medium.en',
    filename: 'ggml-medium.en.bin',
    name: 'Medium (English-only)',
    description: 'High accuracy for English, faster than multilingual medium.',
    sizeBytes: 1500 * 1024 * 1024,
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-medium.en.bin`,
  },
  {
    id: 'Xenova/whisper-large',
    filename: 'ggml-large-v1.bin',
    name: 'Large V1 (Multilingual)',
    description: 'High accuracy, requires ~4GB RAM. First large model version.',
    sizeBytes: 2900 * 1024 * 1024, // ~2.9GB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-large-v1.bin`,
  },
  {
    id: 'Xenova/whisper-large-v2',
    filename: 'ggml-large-v2.bin',
    name: 'Large V2 (Multilingual)',
    description: 'Improved accuracy over V1. Requires ~4GB RAM.',
    sizeBytes: 2900 * 1024 * 1024,
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-large-v2.bin`,
  },
  {
    id: 'Xenova/whisper-large-v3',
    filename: 'ggml-large-v3-turbo.bin',
    name: 'Large V3 Turbo (Multilingual)',
    description: 'Latest optimized model. Fastest large model with excellent accuracy.',
    sizeBytes: 1500 * 1024 * 1024, // ~1.5GB
    downloadUrl: `${HUGGINGFACE_BASE_URL}/ggml-large-v3-turbo.bin`,
  },
];

// Download progress event emitter
export const downloadEvents = new EventEmitter();

// Track active downloads
const activeDownloads = new Map<string, { progress: number; abortController: AbortController }>();

/**
 * Ensure the models directory exists
 */
export async function ensureModelsDir(): Promise<void> {
  await mkdir(MODELS_DIR, { recursive: true });
}

/**
 * Get the file path for a model
 */
export function getModelPath(filename: string): string {
  return path.join(MODELS_DIR, filename);
}

/**
 * Check if a model is already downloaded
 */
export function isModelDownloaded(filename: string): boolean {
  const modelPath = getModelPath(filename);
  return existsSync(modelPath);
}

/**
 * Get the download progress for a model
 */
export function getDownloadProgress(modelId: string): number | null {
  const download = activeDownloads.get(modelId);
  return download ? download.progress : null;
}

/**
 * Check if a model is currently being downloaded
 */
export function isModelDownloading(modelId: string): boolean {
  return activeDownloads.has(modelId);
}

/**
 * Get model info by ID
 */
export function getModelById(modelId: string): WhisperModel | undefined {
  return WHISPER_MODELS.find(m => m.id === modelId);
}

/**
 * Get model info by filename
 */
export function getModelByFilename(filename: string): WhisperModel | undefined {
  return WHISPER_MODELS.find(m => m.filename === filename);
}

/**
 * Get all models with their download status
 */
export function getAllModelStatuses(): Array<WhisperModel & { downloaded: boolean; downloading: boolean; progress: number | null }> {
  return WHISPER_MODELS.map(model => ({
    ...model,
    downloaded: isModelDownloaded(model.filename),
    downloading: isModelDownloading(model.id),
    progress: getDownloadProgress(model.id),
  }));
}

/**
 * Download a model with progress tracking
 */
export async function downloadModel(modelId: string): Promise<void> {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  // Check if already downloaded
  if (isModelDownloaded(model.filename)) {
    console.log(`[WhisperModels] Model ${modelId} already downloaded`);
    return;
  }

  // Check if already downloading
  if (isModelDownloading(modelId)) {
    throw new Error(`Model ${modelId} is already being downloaded`);
  }

  await ensureModelsDir();

  const modelPath = getModelPath(model.filename);
  const tempPath = `${modelPath}.downloading`;

  // Create abort controller for this download
  const abortController = new AbortController();
  activeDownloads.set(modelId, { progress: 0, abortController });

  console.log(`[WhisperModels] Starting download for ${modelId} from ${model.downloadUrl}`);

  try {
    const response = await fetch(model.downloadUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : model.sizeBytes;
    let downloadedSize = 0;

    // Create write stream
    const fileStream = createWriteStream(tempPath);

    // Download with progress tracking
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      fileStream.write(value);
      downloadedSize += value.length;

      // Calculate progress
      const progress = Math.round((downloadedSize / totalSize) * 100);

      // Update progress
      const download = activeDownloads.get(modelId);
      if (download) {
        download.progress = progress;
      }

      // Emit progress event
      downloadEvents.emit('progress', { modelId, progress, downloadedSize, totalSize });
    }

    fileStream.end();

    // Wait for file to be fully written
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Rename temp file to final name
    const { rename } = await import('node:fs/promises');
    await rename(tempPath, modelPath);

    console.log(`[WhisperModels] Successfully downloaded ${modelId}`);

    // Emit completion event
    downloadEvents.emit('complete', { modelId });
  } catch (error) {
    // Clean up temp file on error
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Emit error event
    downloadEvents.emit('error', { modelId, error });

    if ((error as Error).name === 'AbortError') {
      throw new Error('Download cancelled');
    }

    throw error;
  } finally {
    activeDownloads.delete(modelId);
  }
}

/**
 * Cancel an active download
 */
export function cancelDownload(modelId: string): boolean {
  const download = activeDownloads.get(modelId);
  if (download) {
    download.abortController.abort();
    activeDownloads.delete(modelId);
    console.log(`[WhisperModels] Cancelled download for ${modelId}`);
    return true;
  }
  return false;
}

/**
 * Delete a downloaded model
 */
export async function deleteModel(modelId: string): Promise<boolean> {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const modelPath = getModelPath(model.filename);
  if (existsSync(modelPath)) {
    unlinkSync(modelPath);
    console.log(`[WhisperModels] Deleted model ${modelId}`);
    return true;
  }
  return false;
}

/**
 * Get the total size of all downloaded models
 */
export async function getTotalDownloadedSize(): Promise<number> {
  await ensureModelsDir();

  let totalSize = 0;
  const files = await readdir(MODELS_DIR);

  for (const file of files) {
    const filePath = path.join(MODELS_DIR, file);
    try {
      const stats = statSync(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    } catch {
      // Ignore errors for individual files
    }
  }

  return totalSize;
}

// Ensure models directory exists on module load
ensureModelsDir().catch(console.error);
