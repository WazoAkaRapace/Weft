/**
 * Memories API Routes
 *
 * API endpoints for managing long-term AI agent memories.
 */

import { auth } from "../lib/auth.js";
import { db } from "../db/index.js";
import { memories } from "../db/schema.js";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import {
  indexMemory,
  deleteMemoryVectors,
  indexAllMemoriesForUser,
} from "../mastra/vector/memory-indexer.js";
import { isVectorStoreAvailable } from "../mastra/vector/index.js";

// Memory categories
const VALID_CATEGORIES = ["general", "preference", "fact", "reminder", "goal"] as const;
type MemoryCategory = (typeof VALID_CATEGORIES)[number];

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
 * Validate category
 */
function isValidCategory(category: string): category is MemoryCategory {
  return VALID_CATEGORIES.includes(category as MemoryCategory);
}

/**
 * Handle listing memories
 * GET /api/memories
 *
 * Query params:
 * - category: Filter by category
 * - search: Search in content
 * - minImportance: Minimum importance (1-10)
 * - limit: Max results (default 50, max 100)
 * - offset: Pagination offset
 */
export async function handleGetMemories(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const minImportance = url.searchParams.get("minImportance");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build query conditions
    const conditions = [eq(memories.userId, userId)];

    if (category && isValidCategory(category)) {
      conditions.push(eq(memories.category, category));
    }

    if (search) {
      conditions.push(ilike(memories.content, `%${search}%`));
    }

    // Execute query
    const memoriesList = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.importance), desc(memories.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by minimum importance if specified
    let filteredMemories = memoriesList;
    if (minImportance) {
      const minImp = parseInt(minImportance);
      if (!isNaN(minImp)) {
        filteredMemories = memoriesList.filter((m) => m.importance >= minImp);
      }
    }

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(...conditions));

    return Response.json({
      success: true,
      memories: filteredMemories.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category,
        importance: m.importance,
        sourceType: m.sourceType,
        sourceConversationId: m.sourceConversationId,
        lastAccessedAt: m.lastAccessedAt?.toISOString() || null,
        accessCount: m.accessCount,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error("Error listing memories:", error);
    return Response.json(
      { error: "Failed to list memories", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle creating a new memory
 * POST /api/memories
 *
 * Body:
 * - content: string (required, 10-2000 chars)
 * - category: string (default: "general")
 * - importance: number (default: 5, 1-10)
 */
export async function handleCreateMemory(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      content?: string;
      category?: string;
      importance?: number;
    };

    // Validate content
    if (!body.content || body.content.trim().length < 10) {
      return Response.json(
        { error: "Content must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (body.content.length > 2000) {
      return Response.json(
        { error: "Content must be at most 2000 characters" },
        { status: 400 }
      );
    }

    // Validate category
    const category = body.category || "general";
    if (!isValidCategory(category)) {
      return Response.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate importance
    const importance = body.importance ?? 5;
    if (importance < 1 || importance > 10) {
      return Response.json(
        { error: "Importance must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Create the memory
    const [memory] = await db
      .insert(memories)
      .values({
        userId,
        content: body.content.trim(),
        category,
        importance,
        sourceType: "manual",
      })
      .returning();

    if (!memory) {
      return Response.json({ error: "Failed to create memory" }, { status: 500 });
    }

    // Index the memory in the vector store
    if (isVectorStoreAvailable()) {
      await indexMemory(memory.id, userId, memory.content, memory.category, memory.importance);
    }

    return Response.json({
      success: true,
      memory: {
        id: memory.id,
        content: memory.content,
        category: memory.category,
        importance: memory.importance,
        sourceType: memory.sourceType,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating memory:", error);
    return Response.json(
      { error: "Failed to create memory", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle getting a specific memory
 * GET /api/memories/:id
 */
export async function handleGetMemory(request: Request, memoryId: string): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [memory] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));

    if (!memory) {
      return Response.json({ error: "Memory not found" }, { status: 404 });
    }

    // Update access stats
    await db
      .update(memories)
      .set({
        lastAccessedAt: new Date(),
        accessCount: (memory.accessCount || 0) + 1,
      })
      .where(eq(memories.id, memoryId));

    return Response.json({
      success: true,
      memory: {
        id: memory.id,
        content: memory.content,
        category: memory.category,
        importance: memory.importance,
        sourceType: memory.sourceType,
        sourceConversationId: memory.sourceConversationId,
        lastAccessedAt: memory.lastAccessedAt?.toISOString() || null,
        accessCount: memory.accessCount,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting memory:", error);
    return Response.json(
      { error: "Failed to get memory", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle updating a memory
 * PUT /api/memories/:id
 *
 * Body:
 * - content: string (optional)
 * - category: string (optional)
 * - importance: number (optional)
 */
export async function handleUpdateMemory(request: Request, memoryId: string): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the memory exists and belongs to the user
    const [existingMemory] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));

    if (!existingMemory) {
      return Response.json({ error: "Memory not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      content?: string;
      category?: string;
      importance?: number;
    };

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.content !== undefined) {
      if (body.content.trim().length < 10) {
        return Response.json(
          { error: "Content must be at least 10 characters" },
          { status: 400 }
        );
      }
      if (body.content.length > 2000) {
        return Response.json(
          { error: "Content must be at most 2000 characters" },
          { status: 400 }
        );
      }
      updateData.content = body.content.trim();
    }

    if (body.category !== undefined) {
      if (!isValidCategory(body.category)) {
        return Response.json(
          { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.category = body.category;
    }

    if (body.importance !== undefined) {
      if (body.importance < 1 || body.importance > 10) {
        return Response.json(
          { error: "Importance must be between 1 and 10" },
          { status: 400 }
        );
      }
      updateData.importance = body.importance;
    }

    // Update the memory
    const [updatedMemory] = await db
      .update(memories)
      .set(updateData)
      .where(eq(memories.id, memoryId))
      .returning();

    if (!updatedMemory) {
      return Response.json({ error: "Failed to update memory" }, { status: 500 });
    }

    // Re-index in vector store if content/category/importance changed
    if (isVectorStoreAvailable() && (body.content || body.category || body.importance)) {
      await indexMemory(
        updatedMemory.id,
        userId,
        updatedMemory.content,
        updatedMemory.category,
        updatedMemory.importance
      );
    }

    return Response.json({
      success: true,
      memory: {
        id: updatedMemory.id,
        content: updatedMemory.content,
        category: updatedMemory.category,
        importance: updatedMemory.importance,
        sourceType: updatedMemory.sourceType,
        sourceConversationId: updatedMemory.sourceConversationId,
        lastAccessedAt: updatedMemory.lastAccessedAt?.toISOString() || null,
        accessCount: updatedMemory.accessCount,
        createdAt: updatedMemory.createdAt.toISOString(),
        updatedAt: updatedMemory.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating memory:", error);
    return Response.json(
      { error: "Failed to update memory", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle deleting a memory
 * DELETE /api/memories/:id
 */
export async function handleDeleteMemory(request: Request, memoryId: string): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the memory exists and belongs to the user
    const [existingMemory] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));

    if (!existingMemory) {
      return Response.json({ error: "Memory not found" }, { status: 404 });
    }

    // Delete from vector store first
    if (isVectorStoreAvailable()) {
      await deleteMemoryVectors(memoryId, userId);
    }

    // Delete from database
    await db.delete(memories).where(eq(memories.id, memoryId));

    return Response.json({
      success: true,
      message: "Memory deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting memory:", error);
    return Response.json(
      { error: "Failed to delete memory", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle getting category counts
 * GET /api/memories/categories
 */
export async function handleGetMemoryCategories(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get counts for each category
    const counts = await db
      .select({
        category: memories.category,
        count: sql<number>`count(*)`,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .groupBy(memories.category);

    // Build response with all categories (even if count is 0)
    const categoryCounts: Record<string, number> = {};
    for (const cat of VALID_CATEGORIES) {
      categoryCounts[cat] = 0;
    }
    for (const row of counts) {
      categoryCounts[row.category] = row.count;
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(memories)
      .where(eq(memories.userId, userId));

    return Response.json({
      success: true,
      categories: categoryCounts,
      total,
    });
  } catch (error) {
    console.error("Error getting memory categories:", error);
    return Response.json(
      { error: "Failed to get category counts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Handle reindexing all memories
 * POST /api/memories/reindex
 */
export async function handleReindexMemories(request: Request): Promise<Response> {
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

  try {
    const result = await indexAllMemoriesForUser(userId);

    return Response.json({
      success: true,
      message: "Memory reindexing complete",
      result,
    });
  } catch (error) {
    console.error("Error reindexing memories:", error);
    return Response.json(
      { error: "Failed to reindex memories", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
