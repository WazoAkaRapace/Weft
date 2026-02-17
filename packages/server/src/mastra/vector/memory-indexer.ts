/**
 * Memory Vector Indexer
 *
 * Indexes long-term memories into the vector store for semantic retrieval.
 */

import { MDocument } from "@mastra/rag";
import { db } from "../../db/index.js";
import { memories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { pgVector, VECTOR_INDEX_NAME } from "./index.js";
import { generateEmbedding } from "./embedding.js";

// Memory vector metadata type
export interface MemoryVectorMetadata {
  userId: string;
  type: "memory";
  sourceId: string;
  category: string;
  importance: number;
  content: string;
  createdAt: string;
}

/**
 * Index a memory into the vector store
 *
 * @param memoryId - The memory UUID
 * @param userId - The user UUID for metadata filtering
 * @param content - The memory content
 * @param category - The memory category
 * @param importance - The importance score (1-10)
 */
export async function indexMemory(
  memoryId: string,
  userId: string,
  content: string,
  category: string,
  importance: number
): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping memory indexing");
    return false;
  }

  try {
    // Build the content to index
    const indexContent = `Memory (${category}): ${content}`;

    // Create document and chunk
    const doc = MDocument.fromText(indexContent, {
      userId,
      type: "memory",
      sourceId: memoryId,
      category,
      importance,
      createdAt: new Date().toISOString(),
    });

    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    });

    if (chunks.length === 0) {
      console.warn(`No chunks generated for memory ${memoryId}`);
      return false;
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddings = [await generateEmbedding(chunkTexts.join(" "))];

    // Prepare metadata
    const metadata: MemoryVectorMetadata[] = [{
      userId,
      type: "memory",
      sourceId: memoryId,
      category,
      importance,
      content,
      createdAt: new Date().toISOString(),
    }];

    // First, delete existing vectors for this memory
    await deleteMemoryVectors(memoryId, userId);

    // Upsert new vectors
    await pgVector.upsert({
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata,
    });

    console.log(`Indexed memory ${memoryId}`);
    return true;
  } catch (error) {
    console.error(`Error indexing memory ${memoryId}:`, error);
    return false;
  }
}

/**
 * Delete vectors for a memory
 *
 * @param memoryId - The memory UUID
 * @param userId - The user UUID for safety filtering
 */
export async function deleteMemoryVectors(
  memoryId: string,
  userId: string
): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping memory vector deletion");
    return false;
  }

  try {
    await pgVector.deleteVectors({
      indexName: VECTOR_INDEX_NAME,
      filter: {
        userId,
        type: "memory",
        sourceId: memoryId,
      },
    });

    console.log(`Deleted vectors for memory ${memoryId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting vectors for memory ${memoryId}:`, error);
    return false;
  }
}

/**
 * Touch a memory (update access stats)
 *
 * @param memoryId - The memory UUID
 */
export async function touchMemory(memoryId: string): Promise<void> {
  try {
    // Get current access count
    const [memory] = await db
      .select({ accessCount: memories.accessCount })
      .from(memories)
      .where(eq(memories.id, memoryId));

    if (memory) {
      // Update access stats
      await db
        .update(memories)
        .set({
          lastAccessedAt: new Date(),
          accessCount: (memory.accessCount || 0) + 1,
        })
        .where(eq(memories.id, memoryId));
    }
  } catch (error) {
    console.error(`Error touching memory ${memoryId}:`, error);
  }
}

/**
 * Index all memories for a user
 *
 * @param userId - The user UUID
 * @returns Object with counts of indexed items
 */
export async function indexAllMemoriesForUser(userId: string): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  const result = { total: 0, success: 0, failed: 0 };

  if (!pgVector) {
    console.warn("Vector store not initialized, skipping memory batch indexing");
    return result;
  }

  try {
    // Fetch all memories for the user
    const userMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId));

    result.total = userMemories.length;

    // Index each memory
    for (const memory of userMemories) {
      const success = await indexMemory(
        memory.id,
        userId,
        memory.content,
        memory.category,
        memory.importance
      );
      if (success) {
        result.success++;
      } else {
        result.failed++;
      }
    }

    console.log(`Batch memory indexing complete for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`Error in batch memory indexing for user ${userId}:`, error);
    return result;
  }
}
