/**
 * Get Transcripts Tool
 *
 * Provides the AI agent with access to fetch transcript data
 * for journal entries with proper user scoping for security.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { transcripts, journals } from "../../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Tool to fetch transcripts for specific journal entries
 */
export const getTranscriptsTool = createTool({
  id: "get-transcripts",
  description: "Fetch transcripts for specific journal entries. Returns the full transcript text and optional timestamped segments for detailed analysis of spoken content in journals.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The user ID to fetch transcripts for (required for security)"),
    journalIds: z.array(z.string().uuid()).describe("Array of journal IDs to fetch transcripts for"),
    includeSegments: z.boolean().default(false).describe("Whether to include timestamped segments (for word-by-word timing)"),
  }),
  execute: async ({ userId, journalIds, includeSegments }) => {

    try {
      // First verify that all journals belong to the user
      const userJournals = await db
        .select({ id: journals.id })
        .from(journals)
        .where(and(eq(journals.userId, userId), inArray(journals.id, journalIds)));

      if (userJournals.length !== journalIds.length) {
        return {
          success: false,
          error: "Some journal IDs do not belong to the user or do not exist",
          transcripts: [],
        };
      }

      // Fetch transcripts
      const transcriptsData = await db
        .select({
          journalId: transcripts.journalId,
          text: transcripts.text,
          segments: transcripts.segments,
          createdAt: transcripts.createdAt,
        })
        .from(transcripts)
        .where(inArray(transcripts.journalId, journalIds));

      // Format response
      const result = transcriptsData.map((transcript) => ({
        journalId: transcript.journalId,
        transcript: transcript.text,
        ...(includeSegments && { segments: transcript.segments }),
        createdAt: transcript.createdAt,
      }));

      return {
        success: true,
        count: result.length,
        transcripts: result,
      };
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transcripts",
        transcripts: [],
      };
    }
  },
});
