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

/**
 * Tool to fetch user's daily mood entries
 */
export const getDailyMoodsTool = createTool({
  id: "get-daily-moods",
  description: "Fetch user's daily mood logs with optional date range filtering. Returns mood entries with time of day (morning/afternoon) and optional notes for tracking emotional patterns over time.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("The user ID to fetch moods for (required for security)"),
    startDate: z.string().optional().describe("Filter moods on or after this date (ISO 8601 format)"),
    endDate: z.string().optional().describe("Filter moods on or before this date (ISO 8601 format)"),
    limit: z.number().min(1).max(365).default(30).describe("Maximum number of mood entries to return (default: 30, max: 365)"),
  }),
  execute: async ({ userId, startDate, endDate, limit }) => {

    try {
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
