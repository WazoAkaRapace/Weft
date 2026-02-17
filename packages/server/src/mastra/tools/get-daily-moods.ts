/**
 * Get Daily Moods Tool
 *
 * Provides the AI agent with access to fetch user's daily mood logs
 * with proper user scoping for security.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { db } from "../../db/index.js";
import { dailyMoods } from "../../db/schema.js";
import { eq, gte, lte, and, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "../../lib/request-context.js";

/**
 * Tool to fetch user's daily mood entries
 */
export const getDailyMoodsTool = createTool({
  id: "get-daily-moods",
  description: `Fetch user's daily mood logs.

USAGE: Call when user asks about mood patterns, trends, or emotional history.

PARAMETER GUIDELINES:
- startDate/endDate: Use YYYY-MM-DD format. Leave empty for recent moods.
- limit: USE 14 (default) for 2 weeks. Use 30 for monthly analysis. Use 90+ for long-term patterns. Maximum: 365.`,
  inputSchema: z.object({
    startDate: z.string().optional().describe("Filter moods on/after this date (YYYY-MM-DD). Leave empty for recent."),
    endDate: z.string().optional().describe("Filter moods on/before this date (YYYY-MM-DD). Leave empty for current."),
    limit: z.number().min(1).max(365).default(14).describe('USE 14 (default) for 2 weeks. Use 30 for monthly, 90+ for long-term. Maximum: 365.'),
  }),
  execute: async ({ startDate, endDate, limit }) => {

    try {
      // Get the authenticated user ID from the request context (secure - agent cannot override)
      const userId = getAuthenticatedUserId();

      // Build query conditions
      const conditions = [eq(dailyMoods.userId, userId)];

      // Convert date strings to YYYY-MM-DD format for PostgreSQL
      // postgres.js driver expects strings, not Date objects
      if (startDate) {
        const startDateStr = new Date(startDate).toISOString().split('T')[0];
        conditions.push(gte(dailyMoods.date, startDateStr));
      }

      if (endDate) {
        const endDateStr = new Date(endDate).toISOString().split('T')[0];
        conditions.push(lte(dailyMoods.date, endDateStr));
      }

      // Execute query
      const moodsData = await db
        .select({
          id: dailyMoods.id,
          date: dailyMoods.date,
          mood: dailyMoods.mood,
          timeOfDay: dailyMoods.timeOfDay,
          notes: dailyMoods.notes,
          createdAt: dailyMoods.createdAt,
          updatedAt: dailyMoods.updatedAt,
        })
        .from(dailyMoods)
        .where(and(...conditions))
        .orderBy(desc(dailyMoods.date))
        .limit(limit);

      return {
        success: true,
        count: moodsData.length,
        moods: moodsData,
      };
    } catch (error) {
      console.error("Error fetching daily moods:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch daily moods",
        moods: [],
      };
    }
  },
});
