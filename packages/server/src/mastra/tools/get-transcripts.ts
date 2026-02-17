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
import { getAuthenticatedUserId } from "../../lib/request-context.js";

/**
 * Tool to fetch transcripts for specific journal entries
 */
export const getTranscriptsTool = createTool({
  id: "get-transcripts",
  description: `Fetch transcripts for specific journal entries.

USAGE: Call when you have journal IDs and need the full spoken content.

PARAMETER GUIDELINES:
- journalIds: REQUIRED. Array of journal UUIDs to fetch transcripts for.
- includeSegments: USE false (default). Only set true for word-by-word timing analysis.`,
  inputSchema: z.object({
    journalIds: z.array(z.string().uuid()).describe("REQUIRED: Array of journal UUIDs to fetch transcripts for."),
    includeSegments: z.boolean().default(false).describe('USE false (default). Set true only for word-by-word timing analysis.'),
  }),
  execute: async ({ journalIds, includeSegments }) => {

    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

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
