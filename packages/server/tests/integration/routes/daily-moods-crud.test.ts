/**
 * Daily Moods CRUD API tests
 * Tests the daily mood tracking endpoints separate from journal moods
 *
 * Tests cover:
 * - POST /api/moods - Create/update mood for a day
 * - GET /api/moods - Get moods for date range
 * - GET /api/moods/:date - Get mood for specific date
 * - DELETE /api/moods/:date - Delete mood for a day
 * - Authentication and authorization
 * - Validation and error handling
 * - Edge cases (duplicate dates, invalid emotions, etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import { setupMocks } from '../../helpers/testSetup.js';

// Import route handlers
let handleUpsertMood: any;
let handleGetMoods: any;
let handleGetMoodByDate: any;
let handleDeleteMood: any;
let handleGetCalendarMoods: any;

describe('Daily Moods CRUD API', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  // Valid mood values for daily moods
  const VALID_MOODS = ['happy', 'sad', 'angry', 'neutral', 'sick', 'anxious', 'tired', 'excited', 'fear', 'disgust', 'surprise'] as const;

  beforeEach(async () => {
    setupMocks();

    const routesModule = await import('../../../src/routes/moods.js');
    handleUpsertMood = routesModule.handleUpsertMood;
    handleGetMoods = routesModule.handleGetMoods;
    handleGetMoodByDate = routesModule.handleGetMoodByDate;
    handleDeleteMood = routesModule.handleDeleteMood;
    handleGetCalendarMoods = routesModule.handleGetCalendarMoods;

    db = getTestDb();

    testUser = await createTestUser({
      email: 'dailymood@example.com',
      username: 'dailymooduser',
      name: 'Daily Mood User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-dailymood-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('POST /api/moods - Create/Update Mood', () => {
    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'happy',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('PERMISSION_DENIED');
      });

      it('should return 401 with invalid token', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'happy',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Validation', () => {
      it('should return 400 when date is missing', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            mood: 'happy',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required fields: date and mood');
        expect(data.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when mood is missing', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required fields: date and mood');
        expect(data.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when mood value is invalid', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'joyful', // Not a valid mood
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.error).toContain('Invalid mood value');
        expect(data.error).toContain(VALID_MOODS.join(', '));
      });

      it('should return 400 when date format is invalid', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '01/15/2024', // Wrong format
            mood: 'happy',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid date format. Use YYYY-MM-DD');
        expect(data.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when date is malformed', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-13-45', // Invalid month and day
            mood: 'happy',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid date. Use a valid YYYY-MM-DD date');
        expect(data.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Create Mood', () => {
      it('should create a new mood entry', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'happy',
            notes: 'Great day!',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toBeDefined();
        expect(data.data.mood).toBe('happy');
        expect(data.data.notes).toBe('Great day!');
        expect(data.data.date).toBe('2024-01-15');
        expect(data.error).toBeNull();
        expect(data.code).toBe('SUCCESS');

        // Verify it was saved to database
        const moods = await db
          .select()
          .from(schema.dailyMoods)
          .where(eq(schema.dailyMoods.userId, testUser.id));

        expect(moods.length).toBe(1);
        expect(moods[0].mood).toBe('happy');
      });

      it('should create mood without notes', async () => {
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.mood).toBe('sad');
        expect(data.data.notes).toBeNull();
      });

      it('should accept all valid mood values', async () => {
        for (const mood of VALID_MOODS) {
          const date = `2024-01-${VALID_MOODS.indexOf(mood) + 10}`;

          const request = new Request('http://localhost:3001/api/moods', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              date,
              mood,
            }),
          });

          const response = await handleUpsertMood(request);
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.data.mood).toBe(mood);
        }
      });
    });

    describe('Update Mood', () => {
      it('should update existing mood for the same date', async () => {
        // Create initial mood
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          notes: 'Initial notes',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Update the mood
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
            notes: 'Updated notes',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.mood).toBe('sad');
        expect(data.data.notes).toBe('Updated notes');

        // Verify only one entry exists
        const moods = await db
          .select()
          .from(schema.dailyMoods)
          .where(
            and(
              eq(schema.dailyMoods.userId, testUser.id),
              eq(schema.dailyMoods.date, '2024-01-15')
            )
          );

        expect(moods.length).toBe(1);
      });

      it('should update mood without changing notes', async () => {
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          notes: 'Keep these notes',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'neutral',
            // notes not provided
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.mood).toBe('neutral');
        expect(data.data.notes).toBe('Keep these notes');
      });

      it('should clear notes when explicitly set to empty string', async () => {
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          notes: 'These should be cleared',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
            notes: '',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.notes).toBeNull();
      });

      it('should update updatedAt timestamp', async () => {
        const originalDate = new Date('2024-01-01T00:00:00Z');
        const moodId = crypto.randomUUID();

        await db.insert(schema.dailyMoods).values({
          id: moodId,
          userId: testUser.id,
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          createdAt: originalDate,
          updatedAt: originalDate,
        });

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
          }),
        });

        await handleUpsertMood(request);

        const moods = await db
          .select()
          .from(schema.dailyMoods)
          .where(eq(schema.dailyMoods.id, moodId));

        expect(new Date(moods[0].updatedAt).getTime()).toBeGreaterThan(originalDate.getTime());
      });
    });

    describe('User Isolation', () => {
      it('should not allow users to access other users moods', async () => {
        const otherUser = await createTestUser({
          email: 'other@example.com',
          username: 'otheruser',
          name: 'Other User',
        });

        // Create mood for other user
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: otherUser.id,
          date: '2024-01-15',
          mood: 'happy',
          timeOfDay: 'morning',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Try to update with test user
        const request = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
          }),
        });

        const response = await handleUpsertMood(request);
        const data = await response.json();

        expect(response.status).toBe(200);

        // Verify other user's mood was not changed
        const otherMoods = await db
          .select()
          .from(schema.dailyMoods)
          .where(
            and(
              eq(schema.dailyMoods.userId, otherUser.id),
              eq(schema.dailyMoods.date, '2024-01-15')
            )
          );

        expect(otherMoods.length).toBe(1);
        expect(otherMoods[0].mood).toBe('happy');
      });

      it('should create separate moods for different users on same date', async () => {
        const otherUser = await createTestUser({
          email: 'other2@example.com',
          username: 'otheruser2',
          name: 'Other User 2',
        });

        const otherSession = await createTestSession(otherUser.id, {
          token: 'test-other-token',
        });

        // Create mood for test user
        const request1 = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'happy',
          }),
        });

        await handleUpsertMood(request1);

        // Create mood for other user on same date
        const request2 = new Request('http://localhost:3001/api/moods', {
          method: 'POST',
          headers: getAuthHeaders(otherSession.token),
          body: JSON.stringify({
            date: '2024-01-15',
            mood: 'sad',
          }),
        });

        await handleUpsertMood(request2);

        // Verify both moods exist
        const userMoods = await db
          .select()
          .from(schema.dailyMoods)
          .where(eq(schema.dailyMoods.userId, testUser.id));

        const otherMoods = await db
          .select()
          .from(schema.dailyMoods)
          .where(eq(schema.dailyMoods.userId, otherUser.id));

        expect(userMoods.length).toBe(1);
        expect(userMoods[0].mood).toBe('happy');

        expect(otherMoods.length).toBe(1);
        expect(otherMoods[0].mood).toBe('sad');
      });
    });
  });

  describe('GET /api/moods - Get Moods by Date Range', () => {
    beforeEach(async () => {
      // Create test moods for different dates
      const testData = [
        { date: '2024-01-10', mood: 'happy' as const },
        { date: '2024-01-15', mood: 'sad' as const },
        { date: '2024-01-20', mood: 'angry' as const },
        { date: '2024-02-01', mood: 'neutral' as const },
      ];

      for (const { date, mood } of testData) {
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          date,
          mood,
          timeOfDay: 'morning',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString());
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Validation', () => {
      it('should return 400 when startDate is missing', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required query parameters: startDate and endDate');
      });

      it('should return 400 when endDate is missing', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-01');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required query parameters: startDate and endDate');
      });
    });

    describe('Date Range Filtering', () => {
      it('should return moods within the date range', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.length).toBe(3);
        expect(data.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ date: '2024-01-10', mood: 'happy' }),
            expect.objectContaining({ date: '2024-01-15', mood: 'sad' }),
            expect.objectContaining({ date: '2024-01-20', mood: 'angry' }),
          ])
        );
      });

      it('should return empty array when no moods in range', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-03-01');
        url.searchParams.set('endDate', '2024-03-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
      });

      it('should return moods in chronological order', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        const dates = data.data.map((m: any) => m.date);
        expect(dates).toEqual(['2024-01-10', '2024-01-15', '2024-01-20']);
      });

      it('should include moods on range boundaries', async () => {
        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-10');
        url.searchParams.set('endDate', '2024-01-20');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        expect(data.data.length).toBe(3);
      });
    });

    describe('User Isolation', () => {
      it('should only return moods for the authenticated user', async () => {
        const otherUser = await createTestUser({
          email: 'other3@example.com',
          username: 'otheruser3',
          name: 'Other User 3',
        });

        const otherSession = await createTestSession(otherUser.id, {
          token: 'test-other3-token',
        });

        // Create mood for other user in the same range
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: otherUser.id,
          date: '2024-01-12',
          mood: 'neutral',
          timeOfDay: 'morning',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const url = new URL('http://localhost:3001/api/moods');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetMoods(request);
        const data = await response.json();

        // Should only have test user's moods, not other user's
        expect(data.data.length).toBe(3);
        expect(data.data.every((m: any) => m.userId === testUser.id)).toBe(true);
      });
    });
  });

  describe('GET /api/moods/:date - Get Mood by Date', () => {
    const testDate = '2024-01-15';

    beforeEach(async () => {
      await db.insert(schema.dailyMoods).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        date: testDate,
        mood: 'happy',
        timeOfDay: 'morning',
        notes: 'Test notes',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`);
        const response = await handleGetMoodByDate(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Retrieving Moods', () => {
      it('should return mood for the specified date', async () => {
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`, {
          headers: authHeaders,
        });

        const response = await handleGetMoodByDate(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toBeInstanceOf(Array);
        expect(data.data.length).toBe(1);
        expect(data.data[0].mood).toBe('happy');
        expect(data.data[0].notes).toBe('Test notes');
        expect(data.data[0].date).toBe(testDate);
      });

      it('should return null when mood does not exist for date', async () => {
        const request = new Request('http://localhost:3001/api/moods/2024-12-25', {
          headers: authHeaders,
        });

        const response = await handleGetMoodByDate(request, '2024-12-25');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
      });
    });

    describe('User Isolation', () => {
      it('should not return other users moods', async () => {
        const otherUser = await createTestUser({
          email: 'other4@example.com',
          username: 'otheruser4',
          name: 'Other User 4',
        });

        const otherSession = await createTestSession(otherUser.id, {
          token: 'test-other4-token',
        });

        // Other user queries same date
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`, {
          headers: getAuthHeaders(otherSession.token),
        });

        const response = await handleGetMoodByDate(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual([]);
      });
    });
  });

  describe('DELETE /api/moods/:date - Delete Mood', () => {
    const testDate = '2024-01-15';

    beforeEach(async () => {
      await db.insert(schema.dailyMoods).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        date: testDate,
        mood: 'happy',
        timeOfDay: 'morning',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`, {
          method: 'DELETE',
        });

        const response = await handleDeleteMood(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('PERMISSION_DENIED');
      });
    });

    describe('Deleting Moods', () => {
      it('should delete mood for the specified date', async () => {
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        const response = await handleDeleteMood(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Mood deleted successfully');
        expect(data.error).toBeNull();

        // Verify mood was deleted
        const moods = await db
          .select()
          .from(schema.dailyMoods)
          .where(
            and(
              eq(schema.dailyMoods.userId, testUser.id),
              eq(schema.dailyMoods.date, testDate)
            )
          );

        expect(moods.length).toBe(0);
      });

      it('should return 404 when mood does not exist', async () => {
        const request = new Request('http://localhost:3001/api/moods/2024-12-25', {
          method: 'DELETE',
          headers: authHeaders,
        });

        const response = await handleDeleteMood(request, '2024-12-25');
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.message).toBe('Mood not found');
        expect(data.error).toBe('NOT_FOUND');
      });
    });

    describe('User Isolation', () => {
      it('should not allow deleting other users moods', async () => {
        const otherUser = await createTestUser({
          email: 'other5@example.com',
          username: 'otheruser5',
          name: 'Other User 5',
        });

        const otherSession = await createTestSession(otherUser.id, {
          token: 'test-other5-token',
        });

        // Other user tries to delete test user's mood
        const request = new Request(`http://localhost:3001/api/moods/${testDate}`, {
          method: 'DELETE',
          headers: getAuthHeaders(otherSession.token),
        });

        const response = await handleDeleteMood(request, testDate);
        const data = await response.json();

        expect(response.status).toBe(404);

        // Verify original mood still exists
        const moods = await db
          .select()
          .from(schema.dailyMoods)
          .where(
            and(
              eq(schema.dailyMoods.userId, testUser.id),
              eq(schema.dailyMoods.date, testDate)
            )
          );

        expect(moods.length).toBe(1);
      });
    });
  });

  describe('GET /api/moods/calendar - Calendar View', () => {
    beforeEach(async () => {
      // Create some daily moods
      await db.insert(schema.dailyMoods).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        date: '2024-01-10',
        mood: 'happy',
        timeOfDay: 'morning',
        notes: 'Great day',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create some journal entries with emotions
      await db.insert(schema.journals).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Journal 1',
        videoPath: '/uploads/test1.webm',
        duration: 60,
        dominantEmotion: 'sad',
        createdAt: new Date('2024-01-12T12:00:00Z'),
        updatedAt: new Date(),
      });

      await db.insert(schema.journals).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Journal 2',
        videoPath: '/uploads/test2.webm',
        duration: 60,
        dominantEmotion: 'neutral',
        createdAt: new Date('2024-01-12T18:00:00Z'),
        updatedAt: new Date(),
      });
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        const url = new URL('http://localhost:3001/api/moods/calendar');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString());
        const response = await handleGetCalendarMoods(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Calendar Data Aggregation', () => {
      it('should return combined manual moods and journal emotions', async () => {
        const url = new URL('http://localhost:3001/api/moods/calendar');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetCalendarMoods(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.moods).toBeDefined();

        // Find the day with manual mood
        const manualMoodDay = data.data.moods['2024-01-10'];
        expect(manualMoodDay).toBeDefined();
        expect(manualMoodDay.morningMood).toBe('happy');
        expect(manualMoodDay.morningNotes).toBe('Great day');
        expect(manualMoodDay.hasJournal).toBe(false);

        // Find the day with journal emotions
        const journalDay = data.data.moods['2024-01-12'];
        expect(journalDay).toBeDefined();
        expect(journalDay.morningMood).toBeNull();
        expect(journalDay.hasJournal).toBe(true);
        expect(journalDay.journalEmotions).toContain('sad');
        expect(journalDay.journalEmotions).toContain('neutral');
      });

      it('should prioritize manual mood over journal emotions', async () => {
        // Create a day with both manual mood and journal
        const dateWithBoth = '2024-01-15';
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          date: dateWithBoth,
          mood: 'angry',
          timeOfDay: 'morning',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.journals).values({
          id: crypto.randomUUID(),
          userId: testUser.id,
          title: 'Journal on same day',
          videoPath: '/uploads/test3.webm',
          duration: 60,
          dominantEmotion: 'happy', // Different from manual
          createdAt: new Date(`${dateWithBoth}T12:00:00Z`),
          updatedAt: new Date(),
        });

        const url = new URL('http://localhost:3001/api/moods/calendar');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetCalendarMoods(request);
        const data = await response.json();

        const dayWithBoth = data.data.moods[dateWithBoth];
        expect(dayWithBoth).toBeDefined();
        expect(dayWithBoth.morningMood).toBe('angry'); // Manual mood prioritized
        expect(dayWithBoth.journalEmotions).toContain('happy'); // But journal emotion still shown
      });

      it('should return entry for every day in range', async () => {
        const url = new URL('http://localhost:3001/api/moods/calendar');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetCalendarMoods(request);
        const data = await response.json();

        // Should have entries for days with data (2024-01-10 and 2024-01-12)
        expect(data.data.moods).toBeDefined();
        expect(data.data.moods['2024-01-10']).toBeDefined();
        expect(data.data.moods['2024-01-12']).toBeDefined();
      });
    });

    describe('User Isolation', () => {
      it('should only return data for authenticated user', async () => {
        const otherUser = await createTestUser({
          email: 'other6@example.com',
          username: 'otheruser6',
          name: 'Other User 6',
        });

        const otherSession = await createTestSession(otherUser.id, {
          token: 'test-other6-token',
        });

        // Create mood for other user
        await db.insert(schema.dailyMoods).values({
          id: crypto.randomUUID(),
          userId: otherUser.id,
          date: '2024-01-05',
          mood: 'neutral',
          timeOfDay: 'morning',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const url = new URL('http://localhost:3001/api/moods/calendar');
        url.searchParams.set('startDate', '2024-01-01');
        url.searchParams.set('endDate', '2024-01-31');

        const request = new Request(url.toString(), { headers: authHeaders });
        const response = await handleGetCalendarMoods(request);
        const data = await response.json();

        // Should not include other user's data
        const otherUserDay = data.data.moods['2024-01-05'];
        expect(otherUserDay).toBeUndefined();
      });
    });
  });
});
