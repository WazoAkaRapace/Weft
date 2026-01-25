console.log('Weft Server starting...');

import { auth } from './lib/auth.js';
import { db, closeDatabase } from './db/index.js';
import { users } from './db/schema.js';
import { runMigrations } from './db/migrate.js';
import {
  handleStreamInit,
  handleStreamUpload,
  handleGetJournals,
  handleGetJournal,
  handleDeleteJournal,
  handleUpdateJournal,
} from './routes/journals.js';

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    };
    const { name, username, email, password } = body;

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

    if (url.pathname === '/api/journals/stream' && request.method === 'POST') {
      return addCorsHeaders(await handleStreamUpload(request), request);
    }

    // Journal CRUD endpoints
    if (url.pathname === '/api/journals' && request.method === 'GET') {
      return addCorsHeaders(await handleGetJournals(request), request);
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
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});
