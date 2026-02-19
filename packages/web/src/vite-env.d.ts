/// <reference types="vite/client" />

// Runtime configuration injected by Docker entrypoint
interface RuntimeConfig {
  API_URL?: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }

  // Build-time constants injected via Vite's define option
  const __BUILD_VERSION__: string;
  const __GIT_COMMIT__: string;
  const __BUILD_DATE__: string;
}

export {};
