/**
 * Mood tracking API routes
 *
 * Handles daily mood logging and calendar view endpoints:
 * - POST /api/moods - Create/update mood for a day
 * - GET /api/moods - Get moods for date range
 * - GET /api/moods/:date - Get mood for specific date
 * - DELETE /api/moods/:date - Delete mood for a day
 * - GET /api/moods/calendar - Get calendar view with moods and journal emotions
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { dailyMoods, journals } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * Create or update mood for a specific date
 *
 * POST /api/moods
 *
 * Request body:
 * {
 *   "date": "2024-01-15",       // ISO date string
 *   "mood": "happy",            // "happy" | "sad" | "angry" | "neutral" | "sick" | "anxious" | "tired" | "excited" | "fear" | "disgust" | "surprise"
 *   "timeOfDay": "morning",     // "morning" | "afternoon"
 *   "notes": "Optional notes"
 * }
 *
 * @returns Response with created/updated mood or error
 */
export async function handleUpsertMood(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          data: null,
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
      mood?: string;
      timeOfDay?: string;
      notes?: string;
    };

    const { date, mood, timeOfDay = 'morning', notes } = body;

    // Validate required fields
    if (!date || !mood) {
      return new Response(
        JSON.stringify({
          data: null,
          error: 'Missing required fields: date and mood',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate mood value
    const validMoods = ['happy', 'sad', 'angry', 'neutral', 'sick', 'anxious', 'tired', 'excited', 'fear', 'disgust', 'surprise'];
    if (!validMoods.includes(mood)) {
      return new Response(
        JSON.stringify({
          data: null,
          error: `Invalid mood value. Must be one of: ${validMoods.join(', ')}`,
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate timeOfDay value
    const validTimesOfDay = ['morning', 'afternoon'];
    if (!validTimesOfDay.includes(timeOfDay)) {
      return new Response(
        JSON.stringify({
          data: null,
          error: `Invalid timeOfDay value. Must be one of: ${validTimesOfDay.join(', ')}`,
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return new Response(
        JSON.stringify({
          data: null,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if mood already exists for this date and time of day
    const existingMoods = await db
      .select()
      .from(dailyMoods)
      .where(
        and(
          eq(dailyMoods.userId, session.user.id),
          eq(dailyMoods.date, date),
          eq(dailyMoods.timeOfDay, timeOfDay)
        )
      )
      .limit(1);

    const existingMood = existingMoods[0];

    let result;

    if (existingMood) {
      // Update existing mood
      const updateData: Record<string, unknown> = {
        mood,
        updatedAt: new Date(),
      };

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      await db
        .update(dailyMoods)
        .set(updateData)
        .where(eq(dailyMoods.id, existingMood.id));

      // Get updated mood
      const updatedMoods = await db
        .select()
        .from(dailyMoods)
        .where(eq(dailyMoods.id, existingMood.id))
        .limit(1);

      result = updatedMoods[0];
    } else {
      // Create new mood
      const newMoods = await db
        .insert(dailyMoods)
        .values({
          userId: session.user.id,
          date,
          mood,
          timeOfDay,
          notes: notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      result = newMoods[0];
    }

    return new Response(
      JSON.stringify({
        data: result,
        error: null,
        code: 'SUCCESS',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upsert mood error:', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get moods for a date range
 *
 * GET /api/moods?startDate=2024-01-01&endDate=2024-01-31
 *
 * Query parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 *
 * @returns Response with array of daily moods
 */
export async function handleGetMoods(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          data: [],
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({
          data: [],
          error: 'Missing required query parameters: startDate and endDate',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get moods for date range
    const userMoods = await db
      .select()
      .from(dailyMoods)
      .where(
        and(
          eq(dailyMoods.userId, session.user.id),
          gte(dailyMoods.date, startDate),
          lte(dailyMoods.date, endDate)
        )
      )
      .orderBy(dailyMoods.date);

    return new Response(
      JSON.stringify({
        data: userMoods,
        error: null,
        code: 'SUCCESS',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get moods error:', error);
    return new Response(
      JSON.stringify({
        data: [],
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get mood for a specific date
 *
 * GET /api/moods/:date
 *
 * @returns Response with array of moods for the date (0, 1, or 2 entries)
 */
export async function handleGetMoodByDate(request: Request, date: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          data: null,
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all moods for the date (morning and afternoon)
    const moodList = await db
      .select()
      .from(dailyMoods)
      .where(
        and(
          eq(dailyMoods.userId, session.user.id),
          eq(dailyMoods.date, date)
        )
      )
      .orderBy(dailyMoods.timeOfDay);

    return new Response(
      JSON.stringify({
        data: moodList,
        error: null,
        code: 'SUCCESS',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get mood by date error:', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete mood for a specific date
 *
 * DELETE /api/moods/:date
 * Query params:
 * - timeOfDay: optional "morning" | "afternoon" to delete specific time period
 *
 * @returns Response indicating success or error
 */
export async function handleDeleteMood(request: Request, date: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
          error: 'PERMISSION_DENIED',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters for timeOfDay
    const url = new URL(request.url);
    const timeOfDayParam = url.searchParams.get('timeOfDay');

    // Build where conditions dynamically based on timeOfDay parameter
    const baseConditions = [
      eq(dailyMoods.userId, session.user.id),
      eq(dailyMoods.date, date),
    ];

    const whereConditions = timeOfDayParam
      ? and(...baseConditions, eq(dailyMoods.timeOfDay, timeOfDayParam))
      : and(...baseConditions);

    // Check if mood exists and belongs to user
    const moodList = await db
      .select()
      .from(dailyMoods)
      .where(whereConditions)
      .limit(1);

    const mood = moodList[0];

    if (!mood) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Mood not found',
          error: 'NOT_FOUND',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete mood
    await db
      .delete(dailyMoods)
      .where(eq(dailyMoods.id, mood.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mood deleted successfully',
        error: null,
        code: 'SUCCESS',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete mood error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get calendar view with moods and journal emotions
 *
 * GET /api/moods/calendar?year=2024&month=0
 * GET /api/moods/calendar?startDate=2024-01-01&endDate=2024-01-31
 *
 * Query parameters (one of the following):
 * - year: number (required if using year/month) - Full year (e.g., 2024)
 * - month: number (required if using year/month) - Month index (0-11, where 0=January)
 * - startDate: ISO date string (required if using date range)
 * - endDate: ISO date string (required if using date range)
 *
 * Returns a combined view of manual moods and journal emotions for each day.
 * Manual mood takes precedence when both exist.
 *
 * @returns Response with calendar entries
 */
export async function handleGetCalendarMoods(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          data: [],
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters - accept either year/month or startDate/endDate
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    let startDateStr: string;
    let endDateStr: string;

    if (yearParam && monthParam) {
      // Use year/month to calculate date range
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);

      if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
        return new Response(
          JSON.stringify({
            data: null,
            error: 'Invalid year or month parameter',
            code: 'VALIDATION_ERROR',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // First day of the month
      startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;

      // Last day of the month
      const lastDay = new Date(year, month + 1, 0).getDate();
      endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (startDateParam && endDateParam) {
      // Use provided date range
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    } else {
      return new Response(
        JSON.stringify({
          data: null,
          error: 'Missing required query parameters: year and month, or startDate and endDate',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get manual moods for the date range
    const manualMoods = await db
      .select()
      .from(dailyMoods)
      .where(
        and(
          eq(dailyMoods.userId, session.user.id),
          gte(dailyMoods.date, startDateStr),
          lte(dailyMoods.date, endDateStr)
        )
      )
      .orderBy(dailyMoods.date, dailyMoods.timeOfDay);

    // Create a map for easy lookup - now supports morning and afternoon separately
    const moodMap = new Map<string, {
      morningMood: string | null;
      afternoonMood: string | null;
      morningNotes: string | null;
      afternoonNotes: string | null;
    }>();

    for (const mood of manualMoods) {
      if (!moodMap.has(mood.date)) {
        moodMap.set(mood.date, {
          morningMood: null,
          afternoonMood: null,
          morningNotes: null,
          afternoonNotes: null,
        });
      }
      const entry = moodMap.get(mood.date)!;
      if (mood.timeOfDay === 'morning') {
        entry.morningMood = mood.mood;
        entry.morningNotes = mood.notes;
      } else if (mood.timeOfDay === 'afternoon') {
        entry.afternoonMood = mood.mood;
        entry.afternoonNotes = mood.notes;
      }
    }

    // Get journals within the date range to extract emotions
    // Note: journals use createdAt timestamp, so we need to convert dates to timestamps
    const startDateTime = new Date(startDateStr);
    startDateTime.setHours(0, 0, 0, 0);
    const endDateTime = new Date(endDateStr);
    endDateTime.setHours(23, 59, 59, 999);

    const userJournals = await db
      .select({
        date: sql<string>`DATE(${journals.createdAt})`,
        dominantEmotion: journals.dominantEmotion,
      })
      .from(journals)
      .where(
        and(
          eq(journals.userId, session.user.id),
          gte(journals.createdAt, startDateTime),
          lte(journals.createdAt, endDateTime)
        )
      )
      .orderBy(journals.createdAt);

    // Group journal emotions by date
    const journalEmotionsMap = new Map<string, string[]>();
    for (const journal of userJournals) {
      if (journal.dominantEmotion) {
        const dateStr = journal.date;
        if (!journalEmotionsMap.has(dateStr)) {
          journalEmotionsMap.set(dateStr, []);
        }
        // Use journal emotion directly - all 11 moods are now supported
        journalEmotionsMap.get(dateStr)!.push(journal.dominantEmotion);
      }
    }

    // Generate calendar entries only for days with data (mood or journal emotions)
    const calendarEntries: Array<{
      date: string;
      morningMood: string | null;
      afternoonMood: string | null;
      morningNotes: string | null;
      afternoonNotes: string | null;
      journalEmotions: string[];
      hasJournals: boolean;
    }> = [];

    // Collect all dates that have either a mood or journal emotions
    const datesWithData = new Set<string>();
    for (const [date] of moodMap) {
      datesWithData.add(date);
    }
    for (const [date] of journalEmotionsMap) {
      datesWithData.add(date);
    }

    // Create entries only for dates with data
    for (const dateStr of datesWithData) {
      const moodData = moodMap.get(dateStr);
      const journalEmotions = journalEmotionsMap.get(dateStr) || [];

      calendarEntries.push({
        date: dateStr,
        morningMood: moodData?.morningMood || null,
        afternoonMood: moodData?.afternoonMood || null,
        morningNotes: moodData?.morningNotes || null,
        afternoonNotes: moodData?.afternoonNotes || null,
        journalEmotions,
        hasJournals: journalEmotions.length > 0,
      });
    }

    // Transform calendar entries into the format expected by the frontend
    const moodsRecord: Record<string, {
      morningMood: string | null;
      afternoonMood: string | null;
      morningNotes: string | null;
      afternoonNotes: string | null;
      hasJournal: boolean;
      journalEmotions?: string[];
    }> = {};

    for (const entry of calendarEntries) {
      moodsRecord[entry.date] = {
        morningMood: entry.morningMood,
        afternoonMood: entry.afternoonMood,
        morningNotes: entry.morningNotes,
        afternoonNotes: entry.afternoonNotes,
        hasJournal: entry.hasJournals,
        journalEmotions: entry.journalEmotions.length > 0 ? entry.journalEmotions : undefined,
      };
    }

    return new Response(
      JSON.stringify({
        data: {
          year: yearParam ? parseInt(yearParam, 10) : new Date(startDateStr).getFullYear(),
          month: monthParam ? parseInt(monthParam, 10) : new Date(startDateStr).getMonth(),
          moods: moodsRecord,
        },
        error: null,
        code: 'SUCCESS',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get calendar moods error:', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
