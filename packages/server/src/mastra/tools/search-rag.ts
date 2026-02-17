/**
 * Search RAG Tool
 *
 * Unified semantic search tool for searching across journals, notes, and memories.
 * Uses vector embeddings to find conceptually similar content.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pgVector, VECTOR_INDEX_NAME } from "../vector/index.js";
import { generateEmbedding } from "../vector/embedding.js";
import { getAuthenticatedUserId } from "../../lib/request-context.js";

// Content type enum for filtering
const ContentTypeEnum = z.enum(["journal", "note", "memory", "all"]);

/**
 * Unified search tool for RAG
 */
export const searchRagTool = createTool({
  id: "search-rag",
  description: `Search through the user's content (journals, notes, and memories) using semantic search.

USAGE: Call this tool FIRST for any user query to find relevant content.

PARAMETER GUIDELINES:
- query: The search query describing what you're looking for
- type: USE "all" by default. Only specify "memory", "journal", or "note" if user explicitly asks for that type.
- limit: USE 5 (default). Only increase to 10 if user asks for comprehensive results. Never exceed 10.
- category: Only use when searching memories AND user asks for specific category (preference, fact, goal, etc.)
- minImportance: Only use when searching memories AND you need high-importance items only (use 7+)`,
  inputSchema: z.object({
    query: z.string().min(3).max(500).describe("The search query - what to search for"),
    type: ContentTypeEnum.default("all").describe('Content type filter. USE "all" (default) unless user specifies otherwise. Options: journal, note, memory, all'),
    category: z.string().optional().describe("ONLY for memory searches. Options: general, preference, fact, reminder, goal. Leave empty for all categories."),
    minImportance: z.number().min(1).max(10).optional().describe("ONLY for memory searches. Filter by minimum importance 1-10. Use 7+ for critical items only. Leave empty for all."),
    limit: z.number().min(1).max(20).default(5).describe('USE 5 (default). Use 10 only for comprehensive searches. Maximum: 20.'),
  }),
  execute: async ({ query, type, category, minImportance, limit }) => {
    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      if (!pgVector) {
        return {
          success: false,
          error: "Semantic search is not available",
          results: [],
        };
      }

      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      // Build results object
      const results: {
        journals: Array<{
          score: number;
          sourceId: string;
          title: string;
          content: string;
          createdAt: string;
        }>;
        notes: Array<{
          score: number;
          sourceId: string;
          title: string;
          content: string;
          createdAt: string;
        }>;
        memories: Array<{
          score: number;
          sourceId: string;
          category: string;
          importance: number;
          content: string;
          createdAt: string;
        }>;
      } = {
        journals: [],
        notes: [],
        memories: [],
      };

      // Helper to search a specific content type
      const searchType = async (contentType: "journal" | "note" | "memory") => {
        if (!pgVector) return [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filter: any = {
          userId,
          type: contentType,
        };

        // Add category filter for memories
        if (contentType === "memory" && category) {
          filter.category = category;
        }

        const searchResults = await pgVector.query({
          indexName: VECTOR_INDEX_NAME,
          queryVector: queryEmbedding,
          topK: limit * 2, // Get more to allow for importance filtering
          filter,
        });

        if (!searchResults || searchResults.length === 0) return [];

        return searchResults
          .map((r) => ({
            score: r.score,
            sourceId: r.metadata?.sourceId as string,
            title: r.metadata?.title as string,
            content: r.metadata?.content as string,
            category: r.metadata?.category as string,
            importance: r.metadata?.importance as number,
            createdAt: r.metadata?.createdAt as string,
          }))
          .filter((r) => {
            // Filter by minimum importance for memories
            if (contentType === "memory" && minImportance !== undefined) {
              return (r.importance || 0) >= minImportance;
            }
            return true;
          })
          .slice(0, limit);
      };

      // Search based on requested type(s)
      if (type === "all" || type === "journal") {
        results.journals = (await searchType("journal")).map((r) => ({
          score: r.score,
          sourceId: r.sourceId,
          title: r.title,
          content: r.content,
          createdAt: r.createdAt,
        }));
      }

      if (type === "all" || type === "note") {
        results.notes = (await searchType("note")).map((r) => ({
          score: r.score,
          sourceId: r.sourceId,
          title: r.title,
          content: r.content,
          createdAt: r.createdAt,
        }));
      }

      if (type === "all" || type === "memory") {
        results.memories = (await searchType("memory")).map((r) => ({
          score: r.score,
          sourceId: r.sourceId,
          category: r.category,
          importance: r.importance,
          content: r.content,
          createdAt: r.createdAt,
        }));
      }

      // Calculate totals
      const totalResults = results.journals.length + results.notes.length + results.memories.length;

      return {
        success: true,
        query,
        type,
        totalResults,
        results,
      };
    } catch (error) {
      console.error("Error in RAG search:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to perform search",
        results: {
          journals: [],
          notes: [],
          memories: [],
        },
      };
    }
  },
});
