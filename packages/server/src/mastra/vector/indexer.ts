/**
 * Vector Indexer
 *
 * Core logic for indexing journals and notes into the vector store.
 */

import { MDocument } from "@mastra/rag";
import { db } from "../../db/index.js";
import { journals, transcripts, notes } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { pgVector, VECTOR_INDEX_NAME } from "./index.js";
import { generateEmbeddings } from "./embedding.js";

// Metadata type for vectors
export interface VectorMetadata {
  userId: string;
  type: "journal" | "note";
  sourceId: string;
  title: string;
  content: string;
  createdAt: string;
  additionalData?: {
    mood?: string | null;
    emotion?: string | null;
    parentId?: string | null;
  };
}

/**
 * Initialize the vector index
 * Ensures the index exists and is ready for use
 */
export async function initializeVectorIndex(): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping index initialization");
    return false;
  }

  try {
    // Check if index exists by listing indexes
    const indexes = await pgVector.listIndexes();
    if (!indexes.includes(VECTOR_INDEX_NAME)) {
      // Index will be created by initializeVectorStore in index.ts
      console.log(`Vector index '${VECTOR_INDEX_NAME}' not found, it will be created on startup`);
    }
    return true;
  } catch (error) {
    console.error("Error initializing vector index:", error);
    return false;
  }
}

/**
 * Index a journal entry with its transcript
 *
 * @param journalId - The journal UUID
 * @param userId - The user UUID for metadata filtering
 */
export async function indexJournal(journalId: string, userId: string): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping journal indexing");
    return false;
  }

  try {
    // Fetch the journal
    const [journal] = await db
      .select()
      .from(journals)
      .where(and(eq(journals.id, journalId), eq(journals.userId, userId)));

    if (!journal) {
      console.warn(`Journal ${journalId} not found for user ${userId}`);
      return false;
    }

    // Fetch the transcript if available
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.journalId, journalId));

    // Build the content to index
    const contentParts: string[] = [];

    // Add title
    if (journal.title) {
      contentParts.push(`Title: ${journal.title}`);
    }

    // Add notes
    if (journal.notes) {
      contentParts.push(`Notes: ${journal.notes}`);
    }

    // Add transcript
    if (transcript?.text) {
      contentParts.push(`Transcript: ${transcript.text}`);
    }

    // Add mood/emotion info
    if (journal.manualMood) {
      contentParts.push(`Mood: ${journal.manualMood}`);
    }
    if (journal.dominantEmotion) {
      contentParts.push(`Detected Emotion: ${journal.dominantEmotion}`);
    }

    const content = contentParts.join("\n\n");

    if (!content.trim()) {
      console.warn(`No content to index for journal ${journalId}`);
      return false;
    }

    // Create document and chunk
    const doc = MDocument.fromText(content, {
      userId,
      type: "journal",
      sourceId: journalId,
      title: journal.title,
      createdAt: journal.createdAt.toISOString(),
    });

    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    });

    if (chunks.length === 0) {
      console.warn(`No chunks generated for journal ${journalId}`);
      return false;
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Prepare metadata for each chunk
    const metadata: VectorMetadata[] = chunks.map((chunk) => ({
      userId,
      type: "journal" as const,
      sourceId: journalId,
      title: journal.title,
      content: chunk.text,
      createdAt: journal.createdAt.toISOString(),
      additionalData: {
        mood: journal.manualMood,
        emotion: journal.dominantEmotion,
      },
    }));

    // First, delete existing vectors for this journal
    await deleteVectorsBySource("journal", journalId, userId);

    // Upsert new vectors
    await pgVector.upsert({
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata,
    });

    console.log(`Indexed journal ${journalId} with ${chunks.length} chunks`);
    return true;
  } catch (error) {
    console.error(`Error indexing journal ${journalId}:`, error);
    return false;
  }
}

/**
 * Index a note entry
 *
 * @param noteId - The note UUID
 * @param userId - The user UUID for metadata filtering
 */
export async function indexNote(noteId: string, userId: string): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping note indexing");
    return false;
  }

  try {
    // Fetch the note
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)));

    if (!note) {
      console.warn(`Note ${noteId} not found for user ${userId}`);
      return false;
    }

    // Build the content to index
    const contentParts: string[] = [];

    // Add title
    if (note.title) {
      contentParts.push(`# ${note.title}`);
    }

    // Add content
    if (note.content) {
      contentParts.push(note.content);
    }

    const content = contentParts.join("\n\n");

    if (!content.trim()) {
      console.warn(`No content to index for note ${noteId}`);
      return false;
    }

    // Create document and chunk using markdown strategy
    const doc = MDocument.fromMarkdown(content, {
      userId,
      type: "note",
      sourceId: noteId,
      title: note.title,
      createdAt: note.createdAt.toISOString(),
    });

    const chunks = await doc.chunk({
      strategy: "markdown",
      maxSize: 512,
      overlap: 50,
    });

    if (chunks.length === 0) {
      console.warn(`No chunks generated for note ${noteId}`);
      return false;
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((chunk) => chunk.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Prepare metadata for each chunk
    const metadata: VectorMetadata[] = chunks.map((chunk) => ({
      userId,
      type: "note" as const,
      sourceId: noteId,
      title: note.title,
      content: chunk.text,
      createdAt: note.createdAt.toISOString(),
      additionalData: {
        parentId: note.parentId,
      },
    }));

    // First, delete existing vectors for this note
    await deleteVectorsBySource("note", noteId, userId);

    // Upsert new vectors
    await pgVector.upsert({
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata,
    });

    console.log(`Indexed note ${noteId} with ${chunks.length} chunks`);
    return true;
  } catch (error) {
    console.error(`Error indexing note ${noteId}:`, error);
    return false;
  }
}

/**
 * Delete vectors by source type and ID
 *
 * @param type - The source type (journal or note)
 * @param sourceId - The source UUID
 * @param userId - The user UUID for safety filtering
 */
export async function deleteVectorsBySource(
  type: "journal" | "note",
  sourceId: string,
  userId: string
): Promise<boolean> {
  if (!pgVector) {
    console.warn("Vector store not initialized, skipping vector deletion");
    return false;
  }

  try {
    await pgVector.deleteVectors({
      indexName: VECTOR_INDEX_NAME,
      filter: {
        userId,
        type,
        sourceId,
      },
    });

    console.log(`Deleted vectors for ${type} ${sourceId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting vectors for ${type} ${sourceId}:`, error);
    return false;
  }
}

/**
 * Index all content for a user
 *
 * @param userId - The user UUID
 * @returns Object with counts of indexed items
 */
export async function indexAllForUser(userId: string): Promise<{
  journals: { total: number; success: number; failed: number };
  notes: { total: number; success: number; failed: number };
}> {
  const result = {
    journals: { total: 0, success: 0, failed: 0 },
    notes: { total: 0, success: 0, failed: 0 },
  };

  if (!pgVector) {
    console.warn("Vector store not initialized, skipping batch indexing");
    return result;
  }

  try {
    // Fetch all journals for the user
    const userJournals = await db
      .select({ id: journals.id })
      .from(journals)
      .where(eq(journals.userId, userId));

    result.journals.total = userJournals.length;

    // Index each journal
    for (const journal of userJournals) {
      const success = await indexJournal(journal.id, userId);
      if (success) {
        result.journals.success++;
      } else {
        result.journals.failed++;
      }
    }

    // Fetch all notes for the user (not deleted)
    const userNotes = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)));

    result.notes.total = userNotes.length;

    // Index each note
    for (const note of userNotes) {
      const success = await indexNote(note.id, userId);
      if (success) {
        result.notes.success++;
      } else {
        result.notes.failed++;
      }
    }

    console.log(`Batch indexing complete for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error(`Error in batch indexing for user ${userId}:`, error);
    return result;
  }
}

/**
 * Get indexing status
 */
export async function getIndexingStatus(): Promise<{
  available: boolean;
  indexName: string;
  vectorCount?: number;
}> {
  if (!pgVector) {
    return {
      available: false,
      indexName: VECTOR_INDEX_NAME,
    };
  }

  try {
    const indexStats = await pgVector.describeIndex({ indexName: VECTOR_INDEX_NAME });
    return {
      available: true,
      indexName: VECTOR_INDEX_NAME,
      vectorCount: indexStats.count,
    };
  } catch (error) {
    console.error("Error getting indexing status:", error);
    return {
      available: false,
      indexName: VECTOR_INDEX_NAME,
    };
  }
}
