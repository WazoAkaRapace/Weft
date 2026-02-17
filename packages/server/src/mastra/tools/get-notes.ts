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
import { getAuthenticatedUserId } from "../../lib/request-context.js";

/**
 * Tool to fetch user's notes with optional filters
 */
export const getNotesTool = createTool({
  id: "get-notes",
  description: `Fetch user's hierarchical notes.

USAGE: Call when user asks about their notes or you need note content.

PARAMETER GUIDELINES:
- parentId: Leave EMPTY to get all notes. Use null for root-level only. Use UUID for children of specific note.
- search: Use for keyword search in titles and content.
- includeDeleted: USE false (default). Always false unless user asks for deleted notes.
- limit: USE 20 (default). Use 50+ only for comprehensive note listing. Maximum: 100.`,
  inputSchema: z.object({
    parentId: z.string().uuid().nullable().optional().describe("Leave EMPTY for all notes. Use null for root-level. Use UUID for children of specific note."),
    search: z.string().optional().describe("Keyword search in note titles and content."),
    includeDeleted: z.boolean().default(false).describe('USE false (default). Never set to true unless user explicitly asks for deleted notes.'),
    limit: z.number().min(1).max(100).default(20).describe('USE 20 (default). Use 50+ for comprehensive listing. Maximum: 100.'),
  }),
  execute: async ({ parentId, search, includeDeleted, limit }) => {

    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

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
