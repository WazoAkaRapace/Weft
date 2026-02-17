/**
 * Memory Management Tools
 *
 * Tools for the AI agent to list, update, and delete memories.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { memories } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { indexMemory, deleteMemoryVectors } from "../vector/memory-indexer.js";
import { getAuthenticatedUserId } from "../../lib/request-context.js";

/**
 * Tool to list user's stored memories
 */
export const listMemoriesTool = createTool({
  id: "list-memories",
  description: `List the user's stored long-term memories.

USAGE: Call FIRST to recall stored facts, preferences, and context about the user.

PARAMETER GUIDELINES:
- category: Leave EMPTY to get all categories. Only filter when user asks for specific type.
- limit: USE 10 (default). Use 20+ only for comprehensive memory review. Maximum: 100.
- minImportance: Leave EMPTY for all. Use 7+ when you need only critical memories.`,
  inputSchema: z.object({
    category: z.enum(["general", "preference", "fact", "reminder", "goal"]).optional().describe("Leave EMPTY for all. Filter by category only when user asks."),
    limit: z.number().min(1).max(100).default(10).describe('USE 10 (default). Use 20+ for comprehensive review. Maximum: 100.'),
    minImportance: z.number().min(1).max(10).optional().describe("Leave EMPTY for all. Use 7+ for critical memories only."),
  }),
  execute: async ({ category, limit, minImportance }) => {
    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      // Build query conditions
      const conditions = [eq(memories.userId, userId)];

      if (category) {
        conditions.push(eq(memories.category, category));
      }

      // Execute query
      const query = db
        .select({
          id: memories.id,
          content: memories.content,
          category: memories.category,
          importance: memories.importance,
          sourceType: memories.sourceType,
          lastAccessedAt: memories.lastAccessedAt,
          accessCount: memories.accessCount,
          createdAt: memories.createdAt,
        })
        .from(memories)
        .where(and(...conditions))
        .orderBy(desc(memories.importance), desc(memories.createdAt))
        .limit(limit);

      let memoriesList = await query;

      // Filter by minimum importance (in memory since Drizzle doesn't support it directly)
      if (minImportance !== undefined) {
        memoriesList = memoriesList.filter((m) => m.importance >= minImportance);
      }

      return {
        success: true,
        count: memoriesList.length,
        memories: memoriesList.map((m) => ({
          id: m.id,
          content: m.content,
          category: m.category,
          importance: m.importance,
          sourceType: m.sourceType,
          lastAccessedAt: m.lastAccessedAt?.toISOString() || null,
          accessCount: m.accessCount,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error("Error listing memories:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list memories",
        memories: [],
      };
    }
  },
});

/**
 * Tool to update an existing memory
 */
export const updateMemoryTool = createTool({
  id: "update-memory",
  description: `Update an existing long-term memory.

USAGE: Call when user wants to modify a stored memory.

PARAMETER GUIDELINES:
- memoryId: REQUIRED. The UUID of the memory to update.
- content: New text content (10-2000 chars). Only provide if changing content.
- category: New category. Only provide if changing category.
- importance: New importance 1-10. Only provide if changing importance.

Only provided fields will be updated. Others remain unchanged.`,
  inputSchema: z.object({
    memoryId: z.string().uuid().describe("REQUIRED: The UUID of the memory to update."),
    content: z.string().min(10).max(2000).optional().describe("New content. Only provide if changing."),
    category: z.enum(["general", "preference", "fact", "reminder", "goal"]).optional().describe("New category. Only provide if changing."),
    importance: z.number().min(1).max(10).optional().describe("New importance 1-10. Only provide if changing."),
  }),
  execute: async ({ memoryId, content, category, importance }) => {
    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      // First verify the memory belongs to the user
      const [existingMemory] = await db
        .select()
        .from(memories)
        .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));

      if (!existingMemory) {
        return {
          success: false,
          error: "Memory not found or access denied",
        };
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (content !== undefined) updateData.content = content;
      if (category !== undefined) updateData.category = category;
      if (importance !== undefined) updateData.importance = importance;

      // Update the memory
      const [updatedMemory] = await db
        .update(memories)
        .set(updateData)
        .where(eq(memories.id, memoryId))
        .returning();

      if (!updatedMemory) {
        return {
          success: false,
          error: "Failed to update memory",
        };
      }

      // Re-index the memory in the vector store if content changed
      if (content !== undefined || category !== undefined || importance !== undefined) {
        await indexMemory(
          updatedMemory.id,
          userId,
          updatedMemory.content,
          updatedMemory.category,
          updatedMemory.importance
        );
      }

      return {
        success: true,
        memory: {
          id: updatedMemory.id,
          content: updatedMemory.content,
          category: updatedMemory.category,
          importance: updatedMemory.importance,
          updatedAt: updatedMemory.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      console.error("Error updating memory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update memory",
      };
    }
  },
});

/**
 * Tool to delete a memory
 */
export const deleteMemoryTool = createTool({
  id: "delete-memory",
  description: `Delete a long-term memory.

USAGE: Call ONLY when user explicitly asks to delete a specific memory.

WARNING: This action cannot be undone.

PARAMETER GUIDELINES:
- memoryId: REQUIRED. The UUID of the memory to delete.`,
  inputSchema: z.object({
    memoryId: z.string().uuid().describe("REQUIRED: The UUID of the memory to delete."),
  }),
  execute: async ({ memoryId }) => {
    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      // First verify the memory belongs to the user
      const [existingMemory] = await db
        .select()
        .from(memories)
        .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));

      if (!existingMemory) {
        return {
          success: false,
          error: "Memory not found or access denied",
        };
      }

      // Delete from vector store first
      await deleteMemoryVectors(memoryId, userId);

      // Delete from database
      await db.delete(memories).where(eq(memories.id, memoryId));

      return {
        success: true,
        message: "Memory deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting memory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete memory",
      };
    }
  },
});
