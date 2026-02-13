/// <reference types="vite/client" />

// Runtime configuration injected by Docker entrypoint
interface RuntimeConfig {
  API_URL?: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export {};
