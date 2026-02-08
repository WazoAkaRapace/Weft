import { http, HttpResponse } from 'msw';
import { mockJournal, mockJournalList, mockNote, mockNoteTree } from '../fixtures/journals';
import { mockTranscript } from '../fixtures/transcripts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const handlers = [
  // Authentication
  http.post(`${API_BASE}/api/signin/email`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const { email, password } = body;

    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        data: {
          session: {
            user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
            token: 'mock-token',
          },
        },
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post(`${API_BASE}/api/signout`, () => HttpResponse.json({ success: true })),

  http.get(`${API_BASE}/api/session`, ({ request }) => {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    // Check for auth token in headers or cookies
    const hasAuth = authHeader?.includes('mock-token') || cookieHeader?.includes('mock-token');

    if (hasAuth) {
      return HttpResponse.json({
        data: {
          session: {
            user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
          },
        },
      });
    }

    return HttpResponse.json({ data: { session: null } });
  }),

  // Onboarding check
  http.get(`${API_BASE}/api/onboarding/check`, () => {
    return HttpResponse.json({ data: { hasUsers: true } });
  }),

  // Journals
  http.get(`${API_BASE}/api/journals/paginated`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    return HttpResponse.json({
      data: mockJournalList.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: mockJournalList.length,
        totalPages: Math.ceil(mockJournalList.length / limit),
        hasNextPage: page * limit < mockJournalList.length,
        hasPrevPage: page > 1,
      },
    });
  }),

  http.get(`${API_BASE}/api/journals/:id`, ({ params }) => {
    if (params.id === 'journal-1' || params.id === mockJournal.id) {
      return HttpResponse.json({ data: mockJournal });
    }

    if (params.id === 'not-found') {
      return HttpResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    if (params.id === 'access-denied') {
      return HttpResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return HttpResponse.json(
      { error: 'Journal not found' },
      { status: 404 }
    );
  }),

  http.put(`${API_BASE}/api/journals/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { ...mockJournal, ...body, id: params.id },
    });
  }),

  http.delete(`${API_BASE}/api/journals/:id`, () => HttpResponse.json({ success: true })),

  // Recording
  http.post(`${API_BASE}/api/journals/stream/init`, () =>
    HttpResponse.json({ data: { streamId: 'stream-123', journalId: 'journal-1' } })
  ),

  http.post(`${API_BASE}/api/journals/stream/chunk`, () =>
    HttpResponse.json({ data: { success: true, streamId: 'stream-123' } })
  ),

  // Transcripts
  http.get(`${API_BASE}/api/journals/:id/transcript`, () =>
    HttpResponse.json({ data: mockTranscript })
  ),

  // Notes
  http.get(`${API_BASE}/api/notes`, () =>
    HttpResponse.json({ data: { notes: [mockNote] } })
  ),

  http.get(`${API_BASE}/api/notes/tree`, () =>
    HttpResponse.json({ data: mockNoteTree })
  ),

  http.post(`${API_BASE}/api/notes`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { id: 'new-note-id', ...mockNote, ...body, createdAt: new Date().toISOString() },
    });
  }),

  http.put(`${API_BASE}/api/notes/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { ...mockNote, ...body, id: params.id },
    });
  }),

  http.delete(`${API_BASE}/api/notes/:id`, () => HttpResponse.json({ success: true })),

  // Journal-Note linking
  http.post(`${API_BASE}/api/notes/:noteId/journals/:journalId`, () =>
    HttpResponse.json({ success: true })
  ),

  http.delete(`${API_BASE}/api/notes/:noteId/journals/:journalId`, () =>
    HttpResponse.json({ success: true })
  ),

  http.get(`${API_BASE}/api/journals/:journalId/notes`, () =>
    HttpResponse.json({ data: { notes: [mockNote] } })
  ),

  // Emotions
  http.get(`${API_BASE}/api/journals/:id/emotions`, () =>
    HttpResponse.json({
      data: {
        dominantEmotion: mockJournal.dominantEmotion,
        emotionTimeline: mockJournal.emotionTimeline,
        emotionScores: mockJournal.emotionScores,
        processingStatus: 'completed',
      },
    })
  ),

  // Job status
  http.get(`${API_BASE}/api/journals/:id/jobs/status`, () =>
    HttpResponse.json({
      data: {
        transcription: { status: 'completed', error: null },
        emotion: { status: 'completed', error: null },
      },
    })
  ),

  http.post(`${API_BASE}/api/journals/:id/jobs/:jobType/retry`, () =>
    HttpResponse.json({ success: true })
  ),

  // Templates
  http.get(`${API_BASE}/api/templates`, () =>
    HttpResponse.json({ data: { templates: [] } })
  ),

  http.post(`${API_BASE}/api/templates`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { id: 'new-template-id', ...body },
    });
  }),

  // Settings
  http.get(`${API_BASE}/api/settings`, () =>
    HttpResponse.json({ data: { theme: 'auto', language: 'en' } })
  ),

  http.put(`${API_BASE}/api/settings`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { ...body } });
  }),
];
