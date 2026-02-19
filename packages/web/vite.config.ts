import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.VITE_BUILD_VERSION || 'dev'),
    __GIT_COMMIT__: JSON.stringify(process.env.VITE_GIT_COMMIT || 'unknown'),
    __BUILD_DATE__: JSON.stringify(process.env.VITE_BUILD_DATE || ''),
  },
});
