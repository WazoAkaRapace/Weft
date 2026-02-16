/**
 * Search Notes Tool
 *
 * Provides the AI agent with advanced search capabilities for notes,
 * allowing separate search in title and content with relevance ranking.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { notes } from "../../db/schema.js";
import { eq, and, isNull, or, ilike, sql, desc } from "drizzle-orm";

/**
 * Tool to search user's notes by title and/or content
 */
export const searchNotesTool = createTool({
  id: "search-notes",
  description: "Search for notes by title and/or content. Use this when the user is looking for specific information in their notes. Returns matching notes with relevance scores and highlighted matches.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The user ID to search notes for (required for security)"),
    query: z.string().min(1).describe("The search query string"),
    searchIn: z.enum(["title", "content", "both"]).default("both").describe("Where to search: 'title' only, 'content' only, or 'both'"),
    matchType: z.enum(["contains", "startsWith", "endsWith", "exact"]).default("contains").describe("How to match the query"),
    caseSensitive: z.boolean().default(false).describe("Whether search should be case sensitive"),
    limit: z.number().min(1).max(50).default(20).describe("Maximum number of results to return (default: 20, max: 50)"),
  }),
  execute: async ({ userId, query, searchIn, matchType, caseSensitive, limit }) => {
    try {
      // Build the search pattern based on match type
      let searchPattern: string;
      switch (matchType) {
        case "startsWith":
          searchPattern = `${query}%`;
          break;
        case "endsWith":
          searchPattern = `%${query}`;
          break;
        case "exact":
          searchPattern = query;
          break;
        case "contains":
        default:
          searchPattern = `%${query}%`;
          break;
      }

      // Build base conditions
      const conditions = [
        eq(notes.userId, userId),
        isNull(notes.deletedAt), // Exclude soft-deleted notes
      ];

      // Build search condition based on searchIn parameter
      let searchCondition;
      const ilikeFn = caseSensitive
        ? (col: typeof notes.title, pattern: string) => sql`${col} LIKE ${pattern}`
        : ilike;

      if (searchIn === "title") {
        searchCondition = ilikeFn(notes.title, searchPattern);
      } else if (searchIn === "content") {
        searchCondition = ilikeFn(notes.content, searchPattern);
      } else {
        // Search in both title and content
        searchCondition = or(
          ilikeFn(notes.title, searchPattern),
          ilikeFn(notes.content, searchPattern)
        );
      }

      if (searchCondition) {
        conditions.push(searchCondition);
      }

      // Execute query
      const results = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          icon: notes.icon,
          color: notes.color,
          parentId: notes.parentId,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(and(...conditions))
        .orderBy(desc(notes.updatedAt))
        .limit(limit);

      // Calculate relevance and highlight matches
      const queryLower = query.toLowerCase();
      const enrichedResults = results.map((note) => {
        let titleRelevance = 0;
        let contentRelevance = 0;

        // Calculate title relevance
        if (searchIn !== "content" && note.title) {
          const titleLower = note.title.toLowerCase();
          if (titleLower === queryLower) {
            titleRelevance = 100; // Exact match
          } else if (titleLower.startsWith(queryLower)) {
            titleRelevance = 80; // Starts with
          } else if (titleLower.includes(queryLower)) {
            titleRelevance = 60; // Contains
          }
        }

        // Calculate content relevance
        if (searchIn !== "title" && note.content) {
          const contentLower = note.content.toLowerCase();
          const matchCount = (contentLower.match(new RegExp(queryLower, "g")) || []).length;
          contentRelevance = Math.min(50, matchCount * 10); // Up to 50 points based on frequency
        }

        const totalRelevance = titleRelevance + contentRelevance;

        // Create content snippet with match context
        let contentSnippet: string | null = null;
        if (note.content) {
          const contentLower = note.content.toLowerCase();
          const matchIndex = contentLower.indexOf(queryLower);
          if (matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 50);
            const end = Math.min(note.content.length, matchIndex + query.length + 50);
            contentSnippet = (start > 0 ? "..." : "") +
              note.content.slice(start, end) +
              (end < note.content.length ? "..." : "");
          } else {
            // No match in content, show beginning
            contentSnippet = note.content.slice(0, 100) + (note.content.length > 100 ? "..." : "");
          }
        }

        return {
          id: note.id,
          title: note.title,
          contentSnippet,
          icon: note.icon,
          color: note.color,
          parentId: note.parentId,
          relevance: totalRelevance,
          matchedIn: titleRelevance > 0
            ? (contentRelevance > 0 ? "title and content" : "title")
            : "content",
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        };
      });

      // Sort by relevance (highest first)
      enrichedResults.sort((a, b) => b.relevance - a.relevance);

      return {
        success: true,
        query,
        searchIn,
        matchType,
        count: enrichedResults.length,
        results: enrichedResults,
      };
    } catch (error) {
      console.error("Error searching notes:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search notes",
        query,
        count: 0,
        results: [],
      };
    }
  },
});
