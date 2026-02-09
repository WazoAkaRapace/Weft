/**
 * Mood API Client Tests
 *
 * Tests the moodApi client functions including:
 * - getCalendarMoods
 * - getMood
 * - upsertMood
 * - deleteMood
 * - Error handling
 * - Request/response formatting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCalendarMoods,
  getMood,
  upsertMood,
  deleteMood,
} from '../moodApi';
import { server } from '../../../test/mocks/server';
import { http, HttpResponse } from 'msw';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

describe('Mood API Client', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('getCalendarMoods', () => {
    it('should fetch calendar moods for year and month', async () => {
      const mockResponse = {
        data: {
          year: 2024,
          month: 0,
          moods: {
            '2024-01-15': {
              morningMood: 'happy',
              afternoonMood: null,
              morningNotes: null,
              afternoonNotes: null,
              hasJournal: false,
              journalEmotions: [],
            },
          },
        },
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(
          `${API_BASE}/api/moods/calendar`,
          ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('year')).toBe('2024');
            expect(url.searchParams.get('month')).toBe('0');

            return HttpResponse.json(mockResponse);
          }
        )
      );

      const result = await getCalendarMoods(2024, 0);

      expect(result).toEqual(mockResponse);
    });

    it('should include credentials in request', async () => {
      let credentialsIncluded = false;

      server.use(
        http.get(
          `${API_BASE}/api/moods/calendar`,
          ({ request }) => {
            credentialsIncluded = request.credentials === 'include';
            return HttpResponse.json({
              data: { year: 2024, month: 0, moods: {} },
              error: null,
              code: 'SUCCESS',
            });
          }
        )
      );

      await getCalendarMoods(2024, 0);

      expect(credentialsIncluded).toBe(true);
    });

    it('should throw error on fetch failure', async () => {
      server.use(
        http.get(`${API_BASE}/api/moods/calendar`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getCalendarMoods(2024, 0)).rejects.toThrow();
    });

    it('should handle multiple moods in response', async () => {
      const mockResponse = {
        data: {
          year: 2024,
          month: 0,
          moods: {
            '2024-01-01': {
              morningMood: 'happy',
              afternoonMood: null,
              morningNotes: null,
              afternoonNotes: null,
              hasJournal: false,
              journalEmotions: [],
            },
            '2024-01-15': {
              morningMood: 'sad',
              afternoonMood: 'happy',
              morningNotes: 'Morning note',
              afternoonNotes: null,
              hasJournal: true,
              journalEmotions: ['happy'],
            },
            '2024-01-31': {
              morningMood: null,
              afternoonMood: 'neutral',
              morningNotes: null,
              afternoonNotes: 'Afternoon note',
              hasJournal: false,
              journalEmotions: [],
            },
          },
        },
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(
          `${API_BASE}/api/moods/calendar`,
          () => HttpResponse.json(mockResponse)
        )
      );

      const result = await getCalendarMoods(2024, 0);

      expect(result.data?.moods).toHaveProperty('2024-01-01');
      expect(result.data?.moods).toHaveProperty('2024-01-15');
      expect(result.data?.moods).toHaveProperty('2024-01-31');
    });
  });

  describe('getMood', () => {
    it('should fetch mood for specific date', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            date: '2024-01-15',
            mood: 'happy',
            timeOfDay: 'morning',
            notes: 'Great morning!',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await getMood('2024-01-15');

      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].mood).toBe('happy');
      expect(result.data?.[0].timeOfDay).toBe('morning');
    });

    it('should return empty array when mood not found', async () => {
      const mockResponse = {
        data: [],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await getMood('2024-01-15');

      expect(result.data).toEqual([]);
    });

    it('should include credentials in request', async () => {
      let credentialsIncluded = false;

      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, ({ request }) => {
          credentialsIncluded = request.credentials === 'include';
          return HttpResponse.json({
            data: [],
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await getMood('2024-01-15');

      expect(credentialsIncluded).toBe(true);
    });

    it('should throw error on fetch failure', async () => {
      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMood('2024-01-15')).rejects.toThrow();
    });

    it('should handle mood without notes', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            date: '2024-01-15',
            mood: 'sad',
            timeOfDay: 'afternoon',
            notes: null,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await getMood('2024-01-15');

      expect(result.data?.[0].notes).toBeNull();
    });

    it('should handle multiple moods for same date (morning and afternoon)', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            date: '2024-01-15',
            mood: 'happy',
            timeOfDay: 'morning',
            notes: 'Good morning',
            createdAt: '2024-01-15T08:00:00Z',
            updatedAt: '2024-01-15T08:00:00Z',
          },
          {
            id: '124',
            date: '2024-01-15',
            mood: 'sad',
            timeOfDay: 'afternoon',
            notes: 'Tired afternoon',
            createdAt: '2024-01-15T14:00:00Z',
            updatedAt: '2024-01-15T14:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.get(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await getMood('2024-01-15');

      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].timeOfDay).toBe('morning');
      expect(result.data?.[1].timeOfDay).toBe('afternoon');
    });
  });

  describe('upsertMood', () => {
    it('should create new mood', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            userId: 'user-1',
            date: '2024-01-15',
            mood: 'happy',
            timeOfDay: 'morning',
            notes: 'Feeling great',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.post(`${API_BASE}/api/moods`, async ({ request }) => {
          const body = await request.json();

          expect(body).toEqual({
            date: '2024-01-15',
            mood: 'happy',
            timeOfDay: 'morning',
            notes: 'Feeling great',
          });

          return HttpResponse.json(mockResponse);
        })
      );

      const entry = {
        date: '2024-01-15',
        mood: 'happy' as const,
        timeOfDay: 'morning' as const,
        notes: 'Feeling great',
      };

      const result = await upsertMood(entry);

      expect(result).toEqual(mockResponse);
    });

    it('should update existing mood', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            userId: 'user-1',
            date: '2024-01-15',
            mood: 'sad',
            timeOfDay: 'afternoon',
            notes: 'Changed my mind',
            createdAt: '2024-01-14T10:00:00Z',
            updatedAt: '2024-01-15T11:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.post(`${API_BASE}/api/moods`, async () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const entry = {
        date: '2024-01-15',
        mood: 'sad' as const,
        timeOfDay: 'afternoon' as const,
        notes: 'Changed my mind',
      };

      const result = await upsertMood(entry);

      expect(result.data?.[0].mood).toBe('sad');
    });

    it('should handle mood without notes', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            userId: 'user-1',
            date: '2024-01-15',
            mood: 'neutral',
            timeOfDay: 'morning',
            notes: null,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.post(`${API_BASE}/api/moods`, async ({ request }) => {
          const body = await request.json();

          expect(body).toHaveProperty('date');
          expect(body).toHaveProperty('mood');
          expect(body).toHaveProperty('timeOfDay');
          // notes might be undefined or not present

          return HttpResponse.json(mockResponse);
        })
      );

      const entry = {
        date: '2024-01-15',
        mood: 'neutral' as const,
        timeOfDay: 'morning' as const,
      };

      const result = await upsertMood(entry);

      expect(result.data?.[0].notes).toBeNull();
    });

    it('should include credentials in request', async () => {
      let credentialsIncluded = false;

      server.use(
        http.post(`${API_BASE}/api/moods`, ({ request }) => {
          credentialsIncluded = request.credentials === 'include';
          return HttpResponse.json({
            data: [
              {
                id: '123',
                userId: 'user-1',
                date: '2024-01-15',
                mood: 'happy',
                timeOfDay: 'morning',
                notes: null,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
              },
            ],
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await upsertMood({
        date: '2024-01-15',
        mood: 'happy',
        timeOfDay: 'morning',
      });

      expect(credentialsIncluded).toBe(true);
    });

    it('should throw error on fetch failure', async () => {
      server.use(
        http.post(`${API_BASE}/api/moods`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(
        upsertMood({ date: '2024-01-15', mood: 'happy', timeOfDay: 'morning' })
      ).rejects.toThrow();
    });

    it('should handle validation errors from server', async () => {
      server.use(
        http.post(`${API_BASE}/api/moods`, () => {
          return HttpResponse.json(
            {
              data: null,
              error: 'Invalid mood value',
              code: 'VALIDATION_ERROR',
            },
            { status: 400 }
          );
        })
      );

      await expect(
        upsertMood({ date: '2024-01-15', mood: 'invalid' as any, timeOfDay: 'morning' })
      ).rejects.toThrow();
    });
  });

  describe('deleteMood', () => {
    it('should delete mood for date and timeOfDay', async () => {
      const mockResponse = {
        success: true,
        message: 'Mood deleted successfully',
        error: null,
        code: 'SUCCESS',
      };

      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('timeOfDay')).toBe('morning');
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await deleteMood('2024-01-15', 'morning');

      expect(result).toEqual(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should throw error on mood not found', async () => {
      const mockResponse = {
        success: false,
        message: 'Mood not found',
        error: 'NOT_FOUND',
        code: 'NOT_FOUND',
      };

      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(mockResponse, { status: 404 });
        })
      );

      // deleteMood throws on 404
      await expect(deleteMood('2024-01-15', 'afternoon')).rejects.toThrow('Failed to delete mood: Not Found');
    });

    it('should include credentials in request', async () => {
      let credentialsIncluded = false;

      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, ({ request }) => {
          credentialsIncluded = request.credentials === 'include';
          return HttpResponse.json({
            success: true,
            message: 'Mood deleted successfully',
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await deleteMood('2024-01-15', 'morning');

      expect(credentialsIncluded).toBe(true);
    });

    it('should throw error on fetch failure', async () => {
      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(deleteMood('2024-01-15', 'afternoon')).rejects.toThrow();
    });

    it('should throw error on unauthorized', async () => {
      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, () => {
          return HttpResponse.json(
            {
              success: false,
              message: 'Unauthorized',
              error: 'PERMISSION_DENIED',
              code: 'PERMISSION_DENIED',
            },
            { status: 401 }
          );
        })
      );

      // deleteMood throws on 401
      await expect(deleteMood('2024-01-15', 'morning')).rejects.toThrow('Failed to delete mood: Unauthorized');
    });

    it('should include timeOfDay parameter in URL', async () => {
      let receivedUrl = '';

      server.use(
        http.delete(`${API_BASE}/api/moods/2024-01-15`, ({ request }) => {
          receivedUrl = request.url;
          return HttpResponse.json({
            success: true,
            message: 'Mood deleted successfully',
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await deleteMood('2024-01-15', 'afternoon');

      expect(receivedUrl).toContain('timeOfDay=afternoon');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Close server to simulate network error
      server.close();

      await expect(getCalendarMoods(2024, 0)).rejects.toThrow();

      // Reopen for other tests
      server.listen({ onUnhandledRequest: 'error' });
    });

    it('should handle malformed JSON responses', async () => {
      server.use(
        http.get(`${API_BASE}/api/moods/calendar`, () => {
          return new HttpResponse('invalid json', {
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      await expect(getCalendarMoods(2024, 0)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      server.use(
        http.get(`${API_BASE}/api/moods/calendar`, async () => {
          // Simulate timeout by never responding
          await new Promise(() => {});
        })
      );

      // This test depends on fetch timeout configuration
      // In a real scenario, you'd want to configure fetch timeout
    });
  });

  describe('Request Formatting', () => {
    it('should format date correctly in URL', async () => {
      let receivedUrl = '';

      server.use(
        http.get(`${API_BASE}/api/moods/:date`, ({ request }) => {
          receivedUrl = request.url;
          return HttpResponse.json({
            data: [],
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await getMood('2024-01-15');

      expect(receivedUrl).toContain('/api/moods/2024-01-15');
    });

    it('should send JSON content type for POST', async () => {
      let contentType = '';

      server.use(
        http.post(`${API_BASE}/api/moods`, ({ request }) => {
          contentType = request.headers.get('content-type') || '';
          return HttpResponse.json({
            data: [
              {
                id: '123',
                userId: 'user-1',
                date: '2024-01-15',
                mood: 'happy',
                timeOfDay: 'morning',
                notes: null,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
              },
            ],
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await upsertMood({ date: '2024-01-15', mood: 'happy', timeOfDay: 'morning' });

      expect(contentType).toContain('application/json');
    });

    it('should include timeOfDay in POST body', async () => {
      let receivedBody: any = null;

      server.use(
        http.post(`${API_BASE}/api/moods`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            data: [
              {
                id: '123',
                userId: 'user-1',
                date: '2024-01-15',
                mood: 'happy',
                timeOfDay: 'afternoon',
                notes: null,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z',
              },
            ],
            error: null,
            code: 'SUCCESS',
          });
        })
      );

      await upsertMood({ date: '2024-01-15', mood: 'happy', timeOfDay: 'afternoon' });

      expect(receivedBody).toHaveProperty('timeOfDay', 'afternoon');
    });
  });
});
