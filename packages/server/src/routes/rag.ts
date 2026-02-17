/**
 * RAG API Routes
 *
 * API endpoints for manual indexing of journals, notes, and checking RAG status.
 */

import { auth } from "../lib/auth.js";
import {
  indexJournal,
  indexNote,
  indexAllForUser,
  deleteVectorsBySource,
  getIndexingStatus,
} from "../mastra/vector/indexer.js";
import { isVectorStoreAvailable } from "../mastra/vector/index.js";

/**
 * Get the authenticated user ID from the request
 */
async function getUserId(request: Request): Promise<string | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Handle indexing a specific journal
 * POST /api/rag/index/journal/:id
 */
export async function handleIndexJournal(
  request: Request,
  journalId: string
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVectorStoreAvailable()) {
    return Response.json(
      { error: "Vector store not available", message: "RAG is not configured" },
      { status: 503 }
    );
  }

  const success = await indexJournal(journalId, userId);

  if (success) {
    return Response.json({
      success: true,
      message: `Journal ${journalId} indexed successfully`,
    });
  } else {
    return Response.json(
      { error: "Indexing failed", message: "Failed to index journal" },
      { status: 500 }
    );
  }
}

/**
 * Handle indexing a specific note
 * POST /api/rag/index/note/:id
 */
export async function handleIndexNote(
  request: Request,
  noteId: string
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVectorStoreAvailable()) {
    return Response.json(
      { error: "Vector store not available", message: "RAG is not configured" },
      { status: 503 }
    );
  }

  const success = await indexNote(noteId, userId);

  if (success) {
    return Response.json({
      success: true,
      message: `Note ${noteId} indexed successfully`,
    });
  } else {
    return Response.json(
      { error: "Indexing failed", message: "Failed to index note" },
      { status: 500 }
    );
  }
}

/**
 * Handle indexing all user content
 * POST /api/rag/index/all
 */
export async function handleIndexAll(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVectorStoreAvailable()) {
    return Response.json(
      { error: "Vector store not available", message: "RAG is not configured" },
      { status: 503 }
    );
  }

  const result = await indexAllForUser(userId);

  return Response.json({
    success: true,
    message: "Batch indexing complete",
    result,
  });
}

/**
 * Handle deleting a journal from the index
 * DELETE /api/rag/index/journal/:id
 */
export async function handleDeleteJournalIndex(
  request: Request,
  journalId: string
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVectorStoreAvailable()) {
    return Response.json(
      { error: "Vector store not available", message: "RAG is not configured" },
      { status: 503 }
    );
  }

  const success = await deleteVectorsBySource("journal", journalId, userId);

  if (success) {
    return Response.json({
      success: true,
      message: `Journal ${journalId} removed from index`,
    });
  } else {
    return Response.json(
      { error: "Deletion failed", message: "Failed to remove journal from index" },
      { status: 500 }
    );
  }
}

/**
 * Handle deleting a note from the index
 * DELETE /api/rag/index/note/:id
 */
export async function handleDeleteNoteIndex(
  request: Request,
  noteId: string
): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVectorStoreAvailable()) {
    return Response.json(
      { error: "Vector store not available", message: "RAG is not configured" },
      { status: 503 }
    );
  }

  const success = await deleteVectorsBySource("note", noteId, userId);

  if (success) {
    return Response.json({
      success: true,
      message: `Note ${noteId} removed from index`,
    });
  } else {
    return Response.json(
      { error: "Deletion failed", message: "Failed to remove note from index" },
      { status: 500 }
    );
  }
}

/**
 * Handle getting RAG status
 * GET /api/rag/status
 */
export async function handleGetRagStatus(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getIndexingStatus();

  return Response.json({
    ...status,
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large",
  });
}
