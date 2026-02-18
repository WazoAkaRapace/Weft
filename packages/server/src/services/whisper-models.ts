/**
 * Whisper Model Definitions
 * Provides model metadata for UI display
 * Model downloading is handled by nodejs-whisper's autoDownloadModelName option
 */

// Model definitions with sizes for UI display
export interface WhisperModel {
  id: string;           // Xenova format: Xenova/whisper-small
  filename: string;     // whisper.cpp format: ggml-small.bin
  name: string;         // Display name
  description: string;
  sizeBytes: number;    // Approximate file size
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'Xenova/whisper-tiny',
    filename: 'ggml-tiny.bin',
    name: 'Tiny (Multilingual)',
    description: 'Fastest, lowest accuracy. Best for quick drafts.',
    sizeBytes: 75 * 1024 * 1024, // ~75MB
  },
  {
    id: 'Xenova/whisper-tiny.en',
    filename: 'ggml-tiny.en.bin',
    name: 'Tiny (English-only)',
    description: 'Fastest for English. Slightly better accuracy than multilingual.',
    sizeBytes: 75 * 1024 * 1024,
  },
  {
    id: 'Xenova/whisper-base',
    filename: 'ggml-base.bin',
    name: 'Base (Multilingual)',
    description: 'Balanced speed and accuracy. Good default option.',
    sizeBytes: 142 * 1024 * 1024, // ~142MB
  },
  {
    id: 'Xenova/whisper-base.en',
    filename: 'ggml-base.en.bin',
    name: 'Base (English-only)',
    description: 'Better accuracy for English than multilingual base.',
    sizeBytes: 142 * 1024 * 1024,
  },
  {
    id: 'Xenova/whisper-small',
    filename: 'ggml-small.bin',
    name: 'Small (Multilingual)',
    description: 'Good accuracy, reasonable speed. Recommended for most users.',
    sizeBytes: 466 * 1024 * 1024, // ~466MB
  },
  {
    id: 'Xenova/whisper-small.en',
    filename: 'ggml-small.en.bin',
    name: 'Small (English-only)',
    description: 'Best accuracy for English at this size.',
    sizeBytes: 466 * 1024 * 1024,
  },
  {
    id: 'Xenova/whisper-medium',
    filename: 'ggml-medium.bin',
    name: 'Medium (Multilingual)',
    description: 'High accuracy, slower processing. Good for important recordings.',
    sizeBytes: 1500 * 1024 * 1024, // ~1.5GB
  },
  {
    id: 'Xenova/whisper-medium.en',
    filename: 'ggml-medium.en.bin',
    name: 'Medium (English-only)',
    description: 'High accuracy for English, faster than multilingual medium.',
    sizeBytes: 1500 * 1024 * 1024,
  },
  {
    id: 'Xenova/whisper-large',
    filename: 'ggml-large-v1.bin',
    name: 'Large V1 (Multilingual)',
    description: 'High accuracy, requires ~4GB RAM. First large model version.',
    sizeBytes: 2900 * 1024 * 1024, // ~2.9GB
  },
  {
    id: 'Xenova/whisper-large-v2',
    filename: 'ggml-large-v2.bin',
    name: 'Large V2 (Multilingual)',
    description: 'Improved accuracy over V1. Requires ~4GB RAM.',
    sizeBytes: 2900 * 1024 * 1024,
  },
  {
    id: 'Xenova/whisper-large-v3',
    filename: 'ggml-large-v3-turbo.bin',
    name: 'Large V3 Turbo (Multilingual)',
    description: 'Latest optimized model. Fastest large model with excellent accuracy.',
    sizeBytes: 1500 * 1024 * 1024, // ~1.5GB
  },
];

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
 * Get all models (for UI display)
 */
export function getAllModels(): WhisperModel[] {
  return WHISPER_MODELS;
}
