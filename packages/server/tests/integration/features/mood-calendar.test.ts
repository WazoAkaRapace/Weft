/**
 * Mood Calendar Integration Tests
 *
 * Tests calendar view data aggregation and mood display scenarios.
 *
 * Calendar Requirements:
 * - Display manual moods as primary indicator
 * - Fall back to detected emotion when no manual mood
 * - Handle days with multiple journal entries
 * - Show empty state for days with no entries
 * - Support month navigation with correct date boundaries
 * - Handle leap years and month length variations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import { setupMocks } from '../../helpers/testSetup.js';
import {
  createJournalWithMood,
  createCalendarEdgeCases,
  VALID_EMOTIONS,
  type EmotionLabel,
} from '../../fixtures/moods.js';

// Import route handlers
let handleGetPaginatedJournals: any;

describe('Mood Calendar - Integration Tests', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    setupMocks();

    const routesModule = await import('../../../src/routes/journals.js');
    handleGetPaginatedJournals = routesModule.handleGetPaginatedJournals;

    db = getTestDb();

    testUser = await createTestUser({
      email: 'calendar-test@example.com',
      username: 'calendaruser',
      name: 'Calendar Test User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-calendar-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('Calendar Mood Display Priority', () => {
    it('should prioritize manual mood over detected emotion', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'Override Test',
        createdAt: today,
        manualMood: 'happy',
        dominantEmotion: 'sad',
        emotionTimeline: [{ time: 0, emotion: 'sad', confidence: 0.9 }],
        emotionScores: { sad: 0.9, neutral: 0.1 },
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBe('happy');
      // Frontend should display manualMood ('happy') not dominantEmotion ('sad')
    });

    it('should use detected emotion when no manual mood', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'Detected Only',
        createdAt: today,
        manualMood: null,
        dominantEmotion: 'surprised',
        emotionTimeline: [{ time: 0, emotion: 'surprise', confidence: 0.85 }],
        emotionScores: { surprise: 0.85, neutral: 0.15 },
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBeNull();
      expect(data.data[0].dominantEmotion).toBe('surprised');
      // Frontend should display dominantEmotion
    });
  });

  describe('Multiple Entries Per Day', () => {
    it('should return all entries for a day', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'Morning',
        createdAt: new Date(today.setHours(8, 0, 0, 0)),
        manualMood: 'neutral',
      });

      await createJournalWithMood(testUser.id, {
        title: 'Afternoon',
        createdAt: new Date(today.setHours(14, 0, 0, 0)),
        dominantEmotion: 'happy',
        emotionTimeline: [{ time: 0, emotion: 'happy', confidence: 0.8 }],
        emotionScores: { happy: 0.8, neutral: 0.2 },
      });

      await createJournalWithMood(testUser.id, {
        title: 'Evening',
        createdAt: new Date(today.setHours(20, 0, 0, 0)),
        manualMood: 'sad',
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(3);

      // Frontend should display most recent manual mood or last detected emotion
      // Evening (sad) should be the displayed mood for the day
    });

    it('should handle day with mix of manual and detected moods', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'Detected Morning',
        createdAt: new Date(today.setHours(9, 0, 0, 0)),
        manualMood: null,
        dominantEmotion: 'fear',
        emotionTimeline: [{ time: 0, emotion: 'fear', confidence: 0.7 }],
        emotionScores: { fear: 0.7, neutral: 0.3 },
      });

      await createJournalWithMood(testUser.id, {
        title: 'Manual Afternoon',
        createdAt: new Date(today.setHours(15, 0, 0, 0)),
        manualMood: 'happy',
        dominantEmotion: null,
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(2);
      expect(data.data[0].dominantEmotion).toBe('fear');
      expect(data.data[1].manualMood).toBe('happy');
    });
  });

  describe('Empty States', () => {
    it('should return empty array for day with no entries', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const startDate = new Date(futureDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(futureDate);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
    });

    it('should return entries with no mood data', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'No Mood Data',
        createdAt: today,
        manualMood: null,
        dominantEmotion: null,
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBeNull();
      expect(data.data[0].dominantEmotion).toBeNull();
      // Frontend should show empty state or neutral indicator
    });
  });

  describe('Month Boundaries', () => {
    it('should handle month transition correctly', async () => {
      // Last day of month
      const lastDay = new Date(2024, 0, 31, 12, 0, 0); // Jan 31
      await createJournalWithMood(testUser.id, {
        title: 'End of Month',
        createdAt: lastDay,
        manualMood: 'happy',
      });

      // First day of next month
      const firstDay = new Date(2024, 1, 1, 12, 0, 0); // Feb 1
      await createJournalWithMood(testUser.id, {
        title: 'Start of Month',
        createdAt: firstDay,
        manualMood: 'sad',
      });

      // Query for January
      const janStart = new Date(2024, 0, 1);
      const janEnd = new Date(2024, 0, 31, 23, 59, 59);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', janStart.toISOString());
      url.searchParams.set('endDate', janEnd.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBe('happy');
    });

    it('should handle leap year (February 29)', async () => {
      const leapDay = new Date(2024, 1, 29, 12, 0, 0); // Feb 29, 2024 (leap year)

      await createJournalWithMood(testUser.id, {
        title: 'Leap Day',
        createdAt: leapDay,
        manualMood: 'surprised',
      });

      const startDate = new Date(2024, 1, 1);
      const endDate = new Date(2024, 1, 29, 23, 59, 59);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBe('surprised');
    });

    it('should handle 31-day month', async () => {
      const thirtyFirst = new Date(2024, 2, 31, 12, 0, 0); // Mar 31

      await createJournalWithMood(testUser.id, {
        title: '31st Day',
        createdAt: thirtyFirst,
        manualMood: 'angry',
      });

      const startDate = new Date(2024, 2, 1);
      const endDate = new Date(2024, 2, 31, 23, 59, 59);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
    });
  });

  describe('Calendar Data Structure', () => {
    it('should provide all required fields for calendar display', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createJournalWithMood(testUser.id, {
        title: 'Calendar Test',
        createdAt: today,
        manualMood: 'happy',
        dominantEmotion: 'neutral',
        emotionTimeline: [{ time: 0, emotion: 'neutral', confidence: 0.6 }],
        emotionScores: { neutral: 0.6, happy: 0.4 },
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);

      const journal = data.data[0];
      expect(journal).toHaveProperty('id');
      expect(journal).toHaveProperty('createdAt');
      expect(journal).toHaveProperty('manualMood');
      expect(journal).toHaveProperty('dominantEmotion');
      expect(journal).toHaveProperty('thumbnailPath');
      expect(journal).toHaveProperty('title');
      expect(journal).toHaveProperty('duration');
    });
  });

  describe('User Isolation', () => {
    it('should only return entries for current user', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      // Create journal for test user
      await createJournalWithMood(testUser.id, {
        title: 'My Journal',
        createdAt: today,
        manualMood: 'happy',
      });

      // Create journal for another user
      const otherUser = await createTestUser({
        email: 'other-calendar@example.com',
        username: 'othercal',
      });

      await createJournalWithMood(otherUser.id, {
        title: 'Other Journal',
        createdAt: today,
        manualMood: 'sad',
      });

      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].manualMood).toBe('happy');
      expect(data.data[0].title).toBe('My Journal');
    });
  });

  describe('Comprehensive Calendar Scenarios', () => {
    it('should handle all calendar edge cases', async () => {
      const edgeCases = await createCalendarEdgeCases(testUser.id);

      // Verify all journals were created
      const journals = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.userId, testUser.id));

      expect(journals.length).toBeGreaterThanOrEqual(6);
    });

    it('should provide diverse mood data for calendar testing', async () => {
      // Create entries with all emotion types
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      for (const emotion of VALID_EMOTIONS) {
        const entryDate = new Date(today);
        entryDate.setDate(entryDate.getDate() + VALID_EMOTIONS.indexOf(emotion));

        await createJournalWithMood(testUser.id, {
          title: `${emotion} Entry`,
          createdAt: entryDate,
          manualMood: emotion,
        });
      }

      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + VALID_EMOTIONS.length + 2);
      endDate.setHours(23, 59, 59, 999);

      const url = new URL('http://localhost:3001/api/journals/paginated');
      url.searchParams.set('startDate', startDate.toISOString());
      url.searchParams.set('endDate', endDate.toISOString());
      url.searchParams.set('limit', '20');

      const request = new Request(url.toString(), { headers: authHeaders });
      const response = await handleGetPaginatedJournals(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(VALID_EMOTIONS.length);

      // Verify all emotions are present
      const retrievedMoods = data.data.map((j: any) => j.manualMood).sort();
      const expectedMoods = [...VALID_EMOTIONS].sort();
      expect(retrievedMoods).toEqual(expectedMoods);
    });
  });
});
