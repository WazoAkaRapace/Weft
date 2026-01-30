console.log('Weft Server starting...');

import path from 'node:path';
import { auth } from './lib/auth.js';
import { db, closeDatabase } from './db/index.js';
import { users } from './db/schema.js';
import { runMigrations } from './db/migrate.js';
import { eq } from 'drizzle-orm';
import {
  handleStreamInit,
  handleStreamUpload,
  handleStreamChunkUpload,
  handleGetJournals,
  handleGetPaginatedJournals,
  handleGetJournal,
  handleDeleteJournal,
  handleUpdateJournal,
  handleGetTranscript,
  handleRetryTranscription,
} from './routes/journals.js';
import {
  handleGetNotes,
  handleGetNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleGetNoteJournals,
  handleLinkNoteToJournal,
  handleUnlinkNoteFromJournal,
} from './routes/notes.js';
import { getTranscriptionQueue } from './queue/TranscriptionQueue.js';

const PORT = process.env.PORT || 3001;

// Get allowed origin from request or default to localhost
function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  return allowedOrigins[0]; // Default to localhost:3000
}

// Add CORS headers to a response
function addCorsHeaders(response: Response, request: Request): Response {
  const allowedOrigin = getAllowedOrigin(request);

  // Create a new response with CORS headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Stream-ID, X-Chunk-Index, X-Is-Last',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    },
  });

  return newResponse;
}

// Better Auth handler for authentication endpoints
// Note: Better Auth works with various frameworks. For Bun, we'll use the fetch API handler
const authRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const authPath = '/api/auth';

  // Better Auth handles its own routing via the auth instance
  if (url.pathname.startsWith(authPath)) {
    // Debug: Log the request
    console.log('[Auth] Request:', {
      method: request.method,
      pathname: url.pathname,
      cookies: request.headers.get('cookie'),
    });

    // Pass the request directly to auth.handler
    // BetterAuth will handle the routing based on the pathname
    const response = await auth.handler(request);

    // Debug: Log the response body for get-session
    const responseBody = await response.clone().text().catch(() => '[could not read body]');
    console.log('[Auth] Response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    });

    return addCorsHeaders(response, request);
  }

  return null;
};

/**
 * Check if any users exist in the database
 * This endpoint is used to determine if onboarding is needed
 */
async function checkUsersExist(): Promise<boolean> {
  try {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    return result.length > 0;
  } catch (error) {
    console.error('Error checking users:', error);
    // Return false on error to allow onboarding (safer default)
    return false;
  }
}

/**
 * API endpoint to check if any users exist
 * GET /api/setup/check-users
 */
async function handleCheckUsers(): Promise<Response> {
  const hasUsers = await checkUsersExist();
  return Response.json({ hasUsers });
}

/**
 * Create the first user (onboarding)
 * POST /api/setup/create-first-user
 *
 * This endpoint is only accessible when no users exist yet.
 * It creates the first user account and then prevents further access.
 */
async function handleCreateFirstUser(request: Request): Promise<Response> {
  // Check if users already exist
  const hasUsers = await checkUsersExist();
  if (hasUsers) {
    return Response.json(
      { error: 'Setup already completed', message: 'Users already exist in the system' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      preferredLanguage?: string;
    };
    const { name, username, email, password, preferredLanguage } = body;

    // Validate required fields
    if (!name || !username || !email || !password) {
      return Response.json(
        { error: 'Missing required fields', message: 'name, username, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate input
    if (!email.includes('@')) {
      return Response.json(
        { error: 'Invalid email', message: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: 'Password too short', message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Use BetterAuth's sign-up endpoint to create the user
    // This ensures the user is created with proper password hashing
    const signUpUrl = new URL('/api/auth/sign-up/email', 'http://localhost:3001');
    const signUpRequest = new Request(signUpUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        username,
      }),
    });

    const signUpResponse = await auth.handler(signUpRequest);

    if (!signUpResponse.ok) {
      const errorData = (await signUpResponse.json().catch(() => ({}))) as {
        message?: string;
      };
      return Response.json(
        { error: 'Failed to create user', message: errorData.message || 'Unknown error' },
        { status: signUpResponse.status }
      );
    }

    // If preferred language is provided, update the user with this preference
    if (preferredLanguage) {
      try {
        // Get the created user from the sign-up response
        const signUpData = (await signUpResponse.json().catch(() => ({}))) as {
          user?: { id: string };
        };

        if (signUpData.user?.id) {
          await db
            .update(users)
            .set({ preferredLanguage })
            .where(eq(users.id, signUpData.user.id));
        }
      } catch (error) {
        console.error('Error setting preferred language:', error);
        // Don't fail the request if we can't set the language
      }
    }

    return Response.json({
      success: true,
      message: 'First user created successfully',
    });
  } catch (error) {
    console.error('Error creating first user:', error);
    return Response.json(
      { error: 'Internal server error', message: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// Run migrations on startup
await runMigrations();

// Check FFmpeg availability
try {
  await Bun.$`ffmpeg -version`.quiet();
  console.log('✓ FFmpeg is available for thumbnail generation');
} catch {
  console.warn('⚠ FFmpeg not found. Thumbnail generation will be disabled.');
}

// Start transcription queue
const transcriptionQueue = getTranscriptionQueue();
await transcriptionQueue.start();
console.log('Transcription queue started');

// Main HTTP server using Bun
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 200 }), request);
    }

    // Handle Better Auth endpoints at /api/auth/*
    const authResponse = await authRoutes(request);
    if (authResponse) {
      return authResponse;
    }

    // Setup/Onboarding endpoints
    if (url.pathname === '/api/setup/check-users' && request.method === 'GET') {
      return addCorsHeaders(await handleCheckUsers(), request);
    }

    if (url.pathname === '/api/setup/create-first-user' && request.method === 'POST') {
      return addCorsHeaders(await handleCreateFirstUser(request), request);
    }

    // Journal stream endpoints
    if (url.pathname === '/api/journals/stream/init' && request.method === 'POST') {
      return addCorsHeaders(await handleStreamInit(request), request);
    }

    if (url.pathname === '/api/journals/stream/chunk' && request.method === 'POST') {
      return addCorsHeaders(await handleStreamChunkUpload(request), request);
    }

    if (url.pathname === '/api/journals/stream' && request.method === 'POST') {
      return addCorsHeaders(await handleStreamUpload(request), request);
    }

    // Journal CRUD endpoints
    // Paginated journals endpoint (must be before /api/journals to avoid conflicts)
    if (url.pathname === '/api/journals/paginated' && request.method === 'GET') {
      return addCorsHeaders(await handleGetPaginatedJournals(request), request);
    }

    if (url.pathname === '/api/journals' && request.method === 'GET') {
      return addCorsHeaders(await handleGetJournals(request), request);
    }

    // Transcript endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/transcript$/) && request.method === 'GET') {
      const journalId = url.pathname.split('/').slice(-2, -1)[0];
      return addCorsHeaders(await handleGetTranscript(request, journalId), request);
    }

    // Retry transcription endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/transcription\/retry$/) && request.method === 'POST') {
      const journalId = url.pathname.split('/').slice(-3, -2)[0];
      return addCorsHeaders(await handleRetryTranscription(request, journalId), request);
    }

    if (url.pathname.startsWith('/api/journals/') && request.method === 'GET') {
      const journalId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleGetJournal(request, journalId), request);
    }

    if (url.pathname.startsWith('/api/journals/') && request.method === 'DELETE') {
      const journalId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleDeleteJournal(request, journalId), request);
    }

    if (url.pathname.startsWith('/api/journals/') && request.method === 'PUT') {
      const journalId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleUpdateJournal(request, journalId), request);
    }

    // Notes CRUD endpoints
    if (url.pathname === '/api/notes' && request.method === 'GET') {
      return addCorsHeaders(await handleGetNotes(request), request);
    }

    if (url.pathname === '/api/notes' && request.method === 'POST') {
      return addCorsHeaders(await handleCreateNote(request), request);
    }

    // Note journals link endpoint (must be before general /api/notes/:id check)
    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals\/[^/]+$/) && request.method === 'DELETE') {
      const segments = url.pathname.split('/');
      const noteId = segments[3];
      const journalId = segments[5];
      return addCorsHeaders(await handleUnlinkNoteFromJournal(request, noteId, journalId), request);
    }

    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals\/[^/]+$/) && request.method === 'POST') {
      const segments = url.pathname.split('/');
      const noteId = segments[3];
      const journalId = segments[5];
      return addCorsHeaders(await handleLinkNoteToJournal(request, noteId, journalId), request);
    }

    // Note journals endpoint (must be before general /api/notes/:id check)
    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals$/) && request.method === 'GET') {
      const noteId = url.pathname.split('/').slice(-2, -1)[0];
      return addCorsHeaders(await handleGetNoteJournals(request, noteId), request);
    }

    if (url.pathname.startsWith('/api/notes/') && request.method === 'GET') {
      const noteId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleGetNote(request, noteId), request);
    }

    if (url.pathname.startsWith('/api/notes/') && request.method === 'PUT') {
      const noteId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleUpdateNote(request, noteId), request);
    }

    if (url.pathname.startsWith('/api/notes/') && request.method === 'DELETE') {
      const noteId = url.pathname.split('/').pop() || '';
      return addCorsHeaders(await handleDeleteNote(request, noteId), request);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return addCorsHeaders(
        Response.json(
          { status: 'ok', timestamp: new Date().toISOString() },
          { status: 200 }
        ),
        request
      );
    }

    // Serve static files (thumbnails and videos)
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') {
      try {
        const filePath = url.pathname.substring(1); // Remove leading slash -> "uploads/..."
        const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
        const fullPath = filePath.startsWith('uploads/')
          ? path.join(UPLOAD_DIR, filePath.substring(8)) // Remove "uploads/" prefix
          : filePath;

        const file = Bun.file(fullPath);
        const exists = await file.exists();

        if (!exists) {
          return addCorsHeaders(
            Response.json(
              { error: 'File not found', path: fullPath },
              { status: 404 }
            ),
            request
          );
        }

        return addCorsHeaders(
          new Response(file, {
            status: 200,
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
          }),
          request
        );
      } catch (error) {
        console.error('Error serving file:', error);
        return addCorsHeaders(
          Response.json(
            { error: 'Failed to serve file' },
            { status: 500 }
          ),
          request
        );
      }
    }

    // Debug endpoint to check session
    if (url.pathname === '/api/debug/session' && request.method === 'GET') {
      try {
        const session = await auth.api.getSession({
          headers: request.headers,
        });

        return addCorsHeaders(
          Response.json({
            session: session,
            cookies: request.headers.get('cookie'),
            cookieHeader: request.headers.get('cookie'),
          }),
          request
        );
      } catch (error) {
        return addCorsHeaders(
          Response.json({
            error: 'Failed to get session',
            details: error instanceof Error ? error.message : String(error),
            cookies: request.headers.get('cookie'),
          }),
          request
        );
      }
    }

    // 404 for unknown routes
    return addCorsHeaders(
      Response.json(
        { error: 'Not Found', message: `Route ${url.pathname} not found` },
        { status: 404 }
      ),
      request
    );
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
console.log(`Better Auth endpoints available at http://localhost:${server.port}/api/auth/*`);

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await transcriptionQueue.stop();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await transcriptionQueue.stop();
  await closeDatabase();
  process.exit(0);
});
