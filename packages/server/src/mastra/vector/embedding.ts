/**
 * Embedding Utilities
 *
 * Provides functions for generating embeddings using Ollama's embedding models.
 */

import { embed, embedMany } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Create OpenAI-compatible provider with Ollama's /v1 endpoint
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: `${ollamaBaseUrl}/v1`,
  apiKey: "ollama", // Ollama doesn't require a real API key
});

// Get embedding model name from env or use default
const embeddingModelName = process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large";

// Create the embedding model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const embeddingModel: any = ollama.embeddingModel(embeddingModelName);

/**
 * Generate an embedding for a single text
 *
 * @param text - The text to embed
 * @returns The embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });

  return embeddings;
}

/**
 * Get the embedding model instance
 * Useful for creating vector query tools
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEmbeddingModel(): any {
  return embeddingModel;
}

/**
 * Get the embedding model name
 */
export function getEmbeddingModelName(): string {
  return embeddingModelName;
}
