console.log('Weft Server starting...');

import { auth } from './lib/auth.js';

const PORT = process.env.PORT || 3001;

// Better Auth handler for authentication endpoints
// Note: Better Auth works with various frameworks. For Bun, we'll use the fetch API handler
const authRoutes = async (request: Request) => {
  const url = new URL(request.url);
  const authPath = '/api/auth';

  // Better Auth handles its own routing via the auth instance
  if (url.pathname.startsWith(authPath)) {
    // Extract the path after /api/auth
    const betterAuthPath = url.pathname.slice(authPath.length);
    const betterAuthUrl = betterAuthPath + url.search;

    // Create a new request with the modified URL as a string
    const betterAuthRequest = new Request(betterAuthUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return auth.handler(betterAuthRequest);
  }

  return null;
};

// Main HTTP server using Bun
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle Better Auth endpoints at /api/auth/*
    const authResponse = await authRoutes(request);
    if (authResponse) {
      return authResponse;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json(
        { status: 'ok', timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }

    // 404 for unknown routes
    return Response.json(
      { error: 'Not Found', message: `Route ${url.pathname} not found` },
      { status: 404 }
    );
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
console.log(`Better Auth endpoints available at http://localhost:${server.port}/api/auth/*`);
