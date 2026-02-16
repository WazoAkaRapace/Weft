/**
 * Get Journals Tool
 *
 * Provides the AI agent with access to fetch user's journal entries
 * with proper user scoping for security.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { journals, transcripts } from "../../db/schema.js";
import { eq, desc, and, or, ilike, gte, lte, inArray } from "drizzle-orm";

/**
 * Tool to fetch user's journal entries with optional filters
 */
export const getJournalsTool = createTool({
  id: "get-journals",
  description: "Fetch user's journal entries with optional filtering by date range, emotion, or search term. Returns journal metadata including title, date, duration, emotion, and notes.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The user ID to fetch journals for (required for security)"),
    limit: z.number().min(1).max(100).default(10).describe("Maximum number of journals to return (default: 10, max: 100)"),
    offset: z.number().min(0).default(0).describe("Number of journals to skip (for pagination)"),
    startDate: z.string().optional().describe("Filter journals created on or after this date (ISO 8601 format)"),
    endDate: z.string().optional().describe("Filter journals created on or before this date (ISO 8601 format)"),
    emotion: z.enum(["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]).optional().describe("Filter by dominant emotion"),
    search: z.string().optional().describe("Search in journal titles and notes"),
    includeTranscripts: z.boolean().default(false).describe("Whether to include transcript text in results"),
  }),
  execute: async ({ userId, limit, offset, startDate, endDate, emotion, search, includeTranscripts }) => {

    try {
      // Build query conditions
      const conditions = [eq(journals.userId, userId)];

      if (startDate) {
        conditions.push(
          // @ts-expect-error - Drizzle ORM type issue with date comparisons
          and(gte(journals.createdAt, new Date(startDate)))
        );
      }

      if (endDate) {
        conditions.push(
          // @ts-expect-error - Drizzle ORM type issue with date comparisons
          and(lte(journals.createdAt, new Date(endDate)))
        );
      }

      if (emotion) {
        conditions.push(eq(journals.dominantEmotion, emotion));
      }

      if (search) {
        conditions.push(
          // @ts-expect-error - Drizzle ORM type issue with ILIKE
          and(
            or(
              ilike(journals.title, `%${search}%`),
              ilike(journals.notes, `%${search}%`)
            )
          )
        );
      }

      // Execute query with joins if transcripts are requested
      let query = db
        .select({
          id: journals.id,
          title: journals.title,
          createdAt: journals.createdAt,
          updatedAt: journals.updatedAt,
          duration: journals.duration,
          location: journals.location,
          notes: journals.notes,
          manualMood: journals.manualMood,
          dominantEmotion: journals.dominantEmotion,
          emotionScores: journals.emotionScores,
          videoPath: journals.videoPath,
          thumbnailPath: journals.thumbnailPath,
        })
        .from(journals)
        .where(and(...conditions))
        .orderBy(desc(journals.createdAt))
        .limit(limit)
        .offset(offset);

      const journalsData = await query;

      // If transcripts requested, fetch them separately for each journal
      let result = journalsData;

      if (includeTranscripts && journalsData.length > 0) {
        const journalIds = journalsData.map((j) => j.id);
        const transcriptsData = await db
          .select({
            journalId: transcripts.journalId,
            text: transcripts.text,
          })
          .from(transcripts)
          .where(inArray(transcripts.journalId, journalIds));

        // Map transcripts to journals
        const transcriptMap = new Map(
          transcriptsData.map((t) => [t.journalId, t.text])
        );

        result = journalsData.map((journal) => ({
          ...journal,
          transcript: transcriptMap.get(journal.id) || null,
        }));
      }

      return {
        success: true,
        count: result.length,
        journals: result,
      };
    } catch (error) {
      console.error("Error fetching journals:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch journals",
        journals: [],
      };
    }
  },
});
