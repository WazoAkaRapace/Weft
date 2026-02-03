console.log('Weft Server starting...');

import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';
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
  handleGetJournalNotes,
  handleDeleteJournal,
  handleUpdateJournal,
  handleGetTranscript,
  handleRetryTranscription,
  handleGetJobsStatus,
} from './routes/journals.js';
import {
  handleGetNotes,
  handleGetNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleReorderNotes,
  handleGetNoteJournals,
  handleLinkNoteToJournal,
  handleUnlinkNoteFromJournal,
} from './routes/notes.js';
import {
  handleGetUserSettings,
  handleUpdateUserSettings,
} from './routes/users.js';
import { getEmotions, retryEmotionAnalysis } from './routes/emotions.js';
import { getTranscriptionQueue } from './queue/TranscriptionQueue.js';
import { getEmotionQueue } from './queue/EmotionQueue.js';

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
// Note: Better Auth works with various frameworks. Using fetch API handler for Node.js
const authRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const authPath = '/api/auth';

  // Better Auth handles its own routing via the auth instance
  if (url.pathname.startsWith(authPath)) {
    // Pass the request directly to auth.handler
    // BetterAuth will handle the routing based on the pathname
    const response = await auth.handler(request);

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
async function checkFFmpeg() {
  return new Promise<boolean>((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✓ FFmpeg is available for thumbnail generation');
        resolve(true);
      } else {
        console.warn('⚠ FFmpeg not found. Thumbnail generation will be disabled.');
        resolve(false);
      }
    });
    ffmpeg.on('error', () => {
      console.warn('⚠ FFmpeg not found. Thumbnail generation will be disabled.');
      resolve(false);
    });
  });
}
await checkFFmpeg();

// Start transcription queue
const transcriptionQueue = getTranscriptionQueue();
await transcriptionQueue.start();
console.log('Transcription queue started');

// Start emotion detection queue (optional - may fail if TensorFlow native bindings are unavailable)
let emotionQueue: ReturnType<typeof getEmotionQueue> | null = null;
try {
  emotionQueue = getEmotionQueue();
  await emotionQueue.start();
  console.log('Emotion detection queue started');
} catch (error) {
  console.warn('⚠ Emotion detection queue failed to start. Emotion analysis will be disabled:', error);
  console.warn('⚠ This is usually due to missing TensorFlow native bindings. The server will continue without emotion detection.');
}

// Main HTTP server using Node.js (compatible with Transformers.js)
const server = createHttpServer(async (req, res) => {
  // Build a Request object compatible with our handlers
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const requestInit: RequestInit = {
    method: req.method,
    headers: new Headers(req.headers as any),
  };

  // Add body if present
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bodyChunks: Buffer[] = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    await new Promise((resolve) => req.on('end', resolve));
    requestInit.body = Buffer.concat(bodyChunks);
  }

  const request = new Request(url.toString(), requestInit);

  try {
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      const response = addCorsHeaders(new Response(null, { status: 200 }), request);
      sendResponse(res, response);
      return;
    }

    // Handle Better Auth endpoints at /api/auth/*
    const authResponse = await authRoutes(request);
    if (authResponse) {
      sendResponse(res, authResponse);
      return;
    }

    // Setup/Onboarding endpoints
    if (url.pathname === '/api/setup/check-users' && req.method === 'GET') {
      sendResponse(res, addCorsHeaders(await handleCheckUsers(), request));
      return;
    }

    if (url.pathname === '/api/setup/create-first-user' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleCreateFirstUser(request), request));
      return;
    }

    // User settings endpoints
    if (url.pathname === '/api/user/settings' && req.method === 'GET') {
      sendResponse(res, addCorsHeaders(await handleGetUserSettings(request), request));
      return;
    }

    if (url.pathname === '/api/user/settings' && req.method === 'PUT') {
      sendResponse(res, addCorsHeaders(await handleUpdateUserSettings(request), request));
      return;
    }

    // Journal stream endpoints
    if (url.pathname === '/api/journals/stream/init' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleStreamInit(request), request));
      return;
    }

    if (url.pathname === '/api/journals/stream/chunk' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleStreamChunkUpload(request), request));
      return;
    }

    if (url.pathname === '/api/journals/stream' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleStreamUpload(request), request));
      return;
    }

    // Journal CRUD endpoints
    // Paginated journals endpoint (must be before /api/journals to avoid conflicts)
    if (url.pathname === '/api/journals/paginated' && req.method === 'GET') {
      sendResponse(res, addCorsHeaders(await handleGetPaginatedJournals(request), request));
      return;
    }

    if (url.pathname === '/api/journals' && req.method === 'GET') {
      sendResponse(res, addCorsHeaders(await handleGetJournals(request), request));
      return;
    }

    // Transcript endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/transcript$/) && req.method === 'GET') {
      const journalId = url.pathname.split('/').slice(-2, -1)[0];
      sendResponse(res, addCorsHeaders(await handleGetTranscript(request, journalId), request));
      return;
    }

    // Jobs status endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/jobs$/) && req.method === 'GET') {
      const journalId = url.pathname.split('/').slice(-2, -1)[0];
      sendResponse(res, addCorsHeaders(await handleGetJobsStatus(request, journalId), request));
      return;
    }

    // Retry transcription endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/transcription\/retry$/) && req.method === 'POST') {
      const journalId = url.pathname.split('/').slice(-3, -2)[0];
      sendResponse(res, addCorsHeaders(await handleRetryTranscription(request, journalId), request));
      return;
    }

    // Emotion detection endpoints (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/emotions\/retry$/) && req.method === 'POST') {
      const journalId = url.pathname.split('/').slice(-3, -2)[0];
      sendResponse(res, addCorsHeaders(await retryEmotionAnalysis(request, { id: journalId }), request));
      return;
    }

    if (url.pathname.match(/\/api\/journals\/[^/]+\/emotions$/) && req.method === 'GET') {
      const journalId = url.pathname.split('/').slice(-2, -1)[0];
      sendResponse(res, addCorsHeaders(await getEmotions(request, { id: journalId }), request));
      return;
    }

    // Journal notes endpoint (must be before general /api/journals/:id check)
    if (url.pathname.match(/\/api\/journals\/[^/]+\/notes$/) && req.method === 'GET') {
      const journalId = url.pathname.split('/').slice(-2, -1)[0];
      sendResponse(res, addCorsHeaders(await handleGetJournalNotes(request, journalId), request));
      return;
    }

    if (url.pathname.startsWith('/api/journals/') && req.method === 'GET') {
      const journalId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleGetJournal(request, journalId), request));
      return;
    }

    if (url.pathname.startsWith('/api/journals/') && req.method === 'DELETE') {
      const journalId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleDeleteJournal(request, journalId), request));
      return;
    }

    if (url.pathname.startsWith('/api/journals/') && req.method === 'PUT') {
      const journalId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleUpdateJournal(request, journalId), request));
      return;
    }

    // Notes CRUD endpoints
    if (url.pathname === '/api/notes' && req.method === 'GET') {
      sendResponse(res, addCorsHeaders(await handleGetNotes(request), request));
      return;
    }

    if (url.pathname === '/api/notes' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleCreateNote(request), request));
      return;
    }

    if (url.pathname === '/api/notes/reorder' && req.method === 'POST') {
      sendResponse(res, addCorsHeaders(await handleReorderNotes(request), request));
      return;
    }

    // Note journals link endpoint (must be before general /api/notes/:id check)
    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals\/[^/]+$/) && req.method === 'DELETE') {
      const segments = url.pathname.split('/');
      const noteId = segments[3];
      const journalId = segments[5];
      sendResponse(res, addCorsHeaders(await handleUnlinkNoteFromJournal(request, noteId, journalId), request));
      return;
    }

    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals\/[^/]+$/) && req.method === 'POST') {
      const segments = url.pathname.split('/');
      const noteId = segments[3];
      const journalId = segments[5];
      sendResponse(res, addCorsHeaders(await handleLinkNoteToJournal(request, noteId, journalId), request));
      return;
    }

    // Note journals endpoint (must be before general /api/notes/:id check)
    if (url.pathname.match(/\/api\/notes\/[^/]+\/journals$/) && req.method === 'GET') {
      const noteId = url.pathname.split('/').slice(-2, -1)[0];
      sendResponse(res, addCorsHeaders(await handleGetNoteJournals(request, noteId), request));
      return;
    }

    if (url.pathname.startsWith('/api/notes/') && req.method === 'GET') {
      const noteId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleGetNote(request, noteId), request));
      return;
    }

    if (url.pathname.startsWith('/api/notes/') && req.method === 'PUT') {
      const noteId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleUpdateNote(request, noteId), request));
      return;
    }

    if (url.pathname.startsWith('/api/notes/') && req.method === 'DELETE') {
      const noteId = url.pathname.split('/').pop() || '';
      sendResponse(res, addCorsHeaders(await handleDeleteNote(request, noteId), request));
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      sendResponse(res, addCorsHeaders(
        Response.json(
          { status: 'ok', timestamp: new Date().toISOString() },
          { status: 200 }
        ),
        request
      ));
      return;
    }

    // Serve static files (thumbnails and videos)
    if (url.pathname.startsWith('/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const filePath = url.pathname.substring(1); // Remove leading slash -> "uploads/..."
        const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
        const fullPath = filePath.startsWith('uploads/')
          ? path.join(UPLOAD_DIR, filePath.substring(8)) // Remove "uploads/" prefix
          : filePath;

        const fs = await import('node:fs/promises');
        try {
          await fs.access(fullPath);
        } catch {
          sendResponse(res, addCorsHeaders(
            Response.json(
              { error: 'File not found', path: fullPath },
              { status: 404 }
            ),
            request
          ));
          return;
        }

        const ext = path.extname(fullPath).toLowerCase();
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.png' ? 'image/png'
          : ext === '.webm' ? 'video/webm'
          : ext === '.mp4' ? 'video/mp4'
          : 'application/octet-stream';

        // Set CORS headers
        const corsHeaders = addCorsHeaders(new Response(), request);
        corsHeaders.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        // Set status and content type
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);

        // For HEAD requests, don't send body
        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        // Stream file to response (for large files like videos)
        const fileStream = await import('node:fs');
        const stat = await fs.stat(fullPath);
        const fileSize = stat.size;
        res.setHeader('Content-Length', fileSize.toString());

        const stream = fileStream.createReadStream(fullPath);
        stream.pipe(res);
        return;
      } catch (error) {
        console.error('Error serving file:', error);
        sendResponse(res, addCorsHeaders(
          Response.json(
            { error: 'Failed to serve file' },
            { status: 500 }
          ),
          request
        ));
        return;
      }
    }

    // 404 for unknown routes
    sendResponse(res, addCorsHeaders(
      Response.json(
        { error: 'Not Found', message: `Route ${url.pathname} not found` },
        { status: 404 }
      ),
      request
    ));
  } catch (error) {
    console.error('Error handling request:', error);
    sendResponse(res, addCorsHeaders(
      Response.json({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      }),
      request
    ));
  }
});

// Helper function to convert Web API Response to Node.js http.ServerResponse
async function sendResponse(res: any, webResponse: Response) {
  // Set status
  res.statusCode = webResponse.status;

  // Set headers
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // Send body
  if (webResponse.body) {
    const reader = webResponse.body.getReader();

    // Check if this is binary content (images, videos, etc.)
    const contentType = webResponse.headers.get('Content-Type') || '';
    const isBinary = contentType.startsWith('image/') ||
                      contentType.startsWith('video/') ||
                      contentType.startsWith('audio/') ||
                      contentType.startsWith('application/octet-stream');

    if (isBinary) {
      // For binary content, write raw bytes without decoding
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // value is Uint8Array, write it directly as a Buffer
        res.write(Buffer.from(value));
      }
    } else {
      // For text content, use TextDecoder
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    }
  }
  res.end();
}

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Better Auth endpoints available at http://localhost:${PORT}/api/auth/*`);
});

// Debug: Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  console.error('[UNCAUGHT EXCEPTION] Stack:', error.stack);
  console.error('[UNCAUGHT EXCEPTION] Memory:', {
    heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
  });
  // Don't exit immediately, let logs flush
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  console.error('[UNHANDLED REJECTION] Promise:', promise);
  console.error('[UNHANDLED REJECTION] Memory:', {
    heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
  });
});

// Log all signals for debugging
['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2', 'SIGHUP'].forEach(signal => {
  process.on(signal, () => {
    console.log(`[SIGNAL] Received ${signal}`);
  });
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await transcriptionQueue.stop();
  if (emotionQueue) await emotionQueue.stop();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await transcriptionQueue.stop();
  if (emotionQueue) await emotionQueue.stop();
  await closeDatabase();
  process.exit(0);
});
