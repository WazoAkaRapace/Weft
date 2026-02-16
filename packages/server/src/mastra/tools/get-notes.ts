/**
 * Get Notes Tool
 *
 * Provides the AI agent with access to fetch user's notes
 * with proper user scoping for security.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { notes } from "../../db/schema.js";
import { eq, desc, and, isNull, or, ilike } from "drizzle-orm";

/**
 * Tool to fetch user's notes with optional filters
 */
export const getNotesTool = createTool({
  id: "get-notes",
  description: "Fetch user's hierarchical notes with optional filtering. Returns note titles, content, icons, colors, and parent-child relationships for organizing thoughts and ideas.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The user ID to fetch notes for (required for security)"),
    parentId: z.string().uuid().nullable().optional().describe("Filter by parent note ID (null for root-level notes)"),
    search: z.string().optional().describe("Search in note titles and content"),
    includeDeleted: z.boolean().default(false).describe("Whether to include soft-deleted notes"),
    limit: z.number().min(1).max(100).default(50).describe("Maximum number of notes to return (default: 50, max: 100)"),
  }),
  execute: async ({ userId, parentId, search, includeDeleted, limit }) => {

    try {
      // Build query conditions
      const conditions = [eq(notes.userId, userId)];

      // Filter by parent if specified
      if (parentId !== undefined) {
        if (parentId === null) {
          conditions.push(isNull(notes.parentId));
        } else {
          conditions.push(eq(notes.parentId, parentId));
        }
      }

      // Filter out deleted notes unless explicitly requested
      if (!includeDeleted) {
        conditions.push(isNull(notes.deletedAt));
      }

      // Add search condition if provided
      if (search) {
        const searchCondition = or(
          ilike(notes.title, `%${search}%`),
          ilike(notes.content, `%${search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Execute query
      const notesData = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          icon: notes.icon,
          color: notes.color,
          parentId: notes.parentId,
          position: notes.position,
          deletedAt: notes.deletedAt,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(and(...conditions))
        .orderBy(notes.position, desc(notes.createdAt))
        .limit(limit);

      return {
        success: true,
        count: notesData.length,
        notes: notesData,
      };
    } catch (error) {
      console.error("Error fetching notes:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notes",
        notes: [],
      };
    }
  },
});
