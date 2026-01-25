console.log('Weft Server starting...');

import { auth } from './lib/auth.js';

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
    // Extract the path after /api/auth
    const betterAuthPath = url.pathname.slice(authPath.length);
    const betterAuthUrl = betterAuthPath + url.search;

    // Create a new request with the modified URL as a string
    const betterAuthRequest = new Request(betterAuthUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const response = await auth.handler(betterAuthRequest);
    return addCorsHeaders(response, request);
  }

  return null;
};

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
