console.log('Weft Server starting...');

// Example: Basic HTTP server
const server = Bun.serve({
  port: 3001,
  fetch(_req) {
    return new Response('Weft Server is running!');
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
