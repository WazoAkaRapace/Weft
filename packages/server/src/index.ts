console.log('Weft Server starting...');

// Basic HTTP server using Bun
const server = Bun.serve({
  port: process.env.PORT || 3001,
  fetch() {
    return new Response('Weft Server is running!');
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
