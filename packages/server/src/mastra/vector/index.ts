/**
 * Vector Store Configuration
 *
 * Configures PgVector for semantic search using PostgreSQL with pgvector extension.
 */

import { PgVector } from "@mastra/pg";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

// Index name for Weft embeddings
export const VECTOR_INDEX_NAME = "weft_embeddings";

// Vector dimension for mxbai-embed-large embedding model
export const VECTOR_DIMENSION = 1024;

/**
 * PgVector instance for storing and querying embeddings
 */
export let pgVector: PgVector | null = null;

/**
 * Initialize the vector store
 * Creates the vector index if it doesn't exist
 */
export async function initializeVectorStore(): Promise<boolean> {
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set, vector store will be disabled");
    return false;
  }

  try {
    pgVector = new PgVector({
      id: "weft-vector-store",
      connectionString: databaseUrl,
    });

    // Create the index if it doesn't exist
    await pgVector.createIndex({
      indexName: VECTOR_INDEX_NAME,
      dimension: VECTOR_DIMENSION,
      metric: "cosine",
    });

    console.log("RAG vector store initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize vector store:", error);
    pgVector = null;
    return false;
  }
}

/**
 * Get the vector store instance
 * Returns null if not initialized
 */
export function getVectorStore(): PgVector | null {
  return pgVector;
}

/**
 * Check if vector store is available
 */
export function isVectorStoreAvailable(): boolean {
  return pgVector !== null;
}
