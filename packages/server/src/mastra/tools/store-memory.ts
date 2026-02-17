/**
 * Store Memory Tool
 *
 * Tool for the AI agent to store important information about the user
 * as long-term memory for future reference.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { memories } from "../../db/schema.js";
import { indexMemory } from "../vector/memory-indexer.js";
import { getAuthenticatedUserId } from "../../lib/request-context.js";

/**
 * Tool to store a long-term memory
 */
export const storeMemoryTool = createTool({
  id: "store-memory",
  description: `Store important information about the user as long-term memory.

WHEN TO USE:
- User explicitly asks to "remember this" or "keep this in mind"
- User shares important personal information (preferences, goals, relationships)
- User mentions something they want recalled in future conversations

CATEGORY GUIDELINES:
- preference: User's likes, dislikes, preferences (USE THIS for preferences)
- fact: Important facts (birthday, job, location, names)
- goal: User's goals, aspirations, things they're working on
- reminder: Things to remind the user about
- general: Default for anything else

IMPORTANCE GUIDELINES:
- USE 5 (default) for normal memories
- USE 7-8 for important preferences or recurring topics
- USE 9-10 ONLY for critical long-term information (allergies, medical, core values)

Always ask before storing sensitive personal information.`,
  inputSchema: z.object({
    content: z.string().min(10).max(2000).describe("The memory content to store (10-2000 characters)"),
    category: z.enum(["general", "preference", "fact", "reminder", "goal"]).default("general").describe('USE "preference" for likes/dislikes, "fact" for facts, "goal" for goals, "general" for other'),
    importance: z.number().min(1).max(10).default(5).describe('USE 5 (default). Use 7-8 for important. Use 9-10 ONLY for critical info.'),
    sourceConversationId: z.string().optional().describe("Optional: conversation ID where this memory was created"),
  }),
  execute: async ({ content, category, importance, sourceConversationId }) => {
    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      // Insert the memory into the database
      const [memory] = await db
        .insert(memories)
        .values({
          userId,
          content,
          category,
          importance,
          sourceType: "conversation",
          sourceConversationId,
        })
        .returning();

      if (!memory) {
        return {
          success: false,
          error: "Failed to create memory",
        };
      }

      // Index the memory in the vector store
      await indexMemory(memory.id, userId, content, category, importance);

      return {
        success: true,
        memoryId: memory.id,
        message: `Memory stored successfully in category "${category}" with importance ${importance}/10`,
      };
    } catch (error) {
      console.error("Error storing memory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to store memory",
      };
    }
  },
});
