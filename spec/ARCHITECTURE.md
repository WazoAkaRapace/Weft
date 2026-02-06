# Weft Architecture

This document describes the architectural decisions and structure of the Weft monorepo.

## Monorepo Structure

```
Weft/
├── packages/
│   ├── web/          # Frontend application (React + Vite)
│   ├── server/       # Backend server (Node.js Runtime)
│   └── shared/       # Shared utilities, types, and constants
├── services/
│   └── voice-emotion-recognition/  # Python microservice for voice emotion detection
├── docker/           # Docker configuration
├── spec/             # Detailed project documentation
├── turbo.json        # Turborepo configuration
├── pnpm-workspace.yaml # pnpm workspace configuration
├── package.json      # Root package.json
└── tsconfig.json     # Shared TypeScript configuration
```

## Packages

### `@weft/web`

The frontend application built with React and Vite.

**Responsibilities:**
- User interface
- Client-side routing (React Router)
- State management (React Context)
- API consumption
- Video playback with HLS.js
- Real-time recording with MediaRecorder API

**Tech Stack:**
- React 19
- TypeScript 5
- Vite 6
- React Router (client-side routing)
- HLS.js (video streaming)
- Tailwind CSS (styling)
- BetterAuth (authentication)

**Port:** 3000

### `@weft/server`

The backend server.

**Responsibilities:**
- REST API endpoints
- Business logic
- Data persistence (PostgreSQL + Drizzle ORM)
- Authentication/authorization (BetterAuth)
- Video upload and streaming
- Job queues for transcription and emotion detection
- FFmpeg integration for video/audio processing

**Tech Stack:**
- Node.js 20
- TypeScript 5
- Drizzle ORM
- PostgreSQL 16
- BetterAuth
- OpenAI Whisper (whisper.cpp/nodejs-whisper)
- face-api.js (facial emotion detection)
- FFmpeg

**Port:** 3001

### `@weft/shared`

Shared code consumed by both web and server packages.

**Contains:**
- TypeScript types and interfaces
- Utility functions
- Configuration constants
- Validation schemas

**Usage:**
```typescript
// In web or server
import { someType, someUtil } from '@weft/shared';
```

### `voice-emotion-recognition` (Python Microservice)

Standalone Python service for voice emotion detection.

**Responsibilities:**
- Voice emotion analysis from audio segments
- SpeechBrain wav2vec2-IEMOCAP model inference
- FastAPI endpoints for emotion prediction

**Tech Stack:**
- Python 3.11
- FastAPI
- SpeechBrain (wav2vec2-IEMOCAP)
- Uvicorn (ASGI server)

**Port:** 8000 (internal only, not exposed to host)

## Dependency Graph

```
@weft/web ─────> @weft/shared
@weft/server ──> @weft/shared
@weft/server ──> voice-emotion-recognition (HTTP API)
```

- `web` and `server` depend on `shared`
- `web` and `server` are independent of each other
- `server` calls `voice-emotion-recognition` for voice emotion analysis
- This enables independent deployment and development

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEB CLIENT (React)                                │
│                           Port: 3000                                        │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ HTTP
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                         API GATEWAY / PROXY                                 │
│                         (Optional - future)                                  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                          BACKEND (Node.js)                                  │
│                          Port: 3001                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        API Routes                                     │  │
│  │  - /api/auth/*     (BetterAuth)                                      │  │
│  │  - /api/journals/*  (CRUD, streaming)                                 │  │
│  │  - /api/notes/*     (Notes, templates, linking)                       │  │
│  │  - /api/transcripts/* (Transcription management)                       │  │
│  │  - /api/emotions/*  (Emotion analysis)                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Services                                       │  │
│  │  - TranscriptionService (Whisper)                                    │  │
│  │  - EmotionDetectionService (face-api.js)                             │  │
│  │  - VoiceEmotionDetectionService (SpeechBrain HTTP client)             │  │
│  │  - UnifiedEmotionDetectionService (merges face + voice)              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Job Queues                                     │  │
│  │  - TranscriptionQueue (background transcription)                     │  │
│  │  - EmotionQueue (background emotion detection)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                    │         │
                    ┌───────────────┘         └───────────────┐
                    │                                           │
┌───────────────────▼──────────────┐     ┌───────────────────▼──────────────┐
│      PostgreSQL (Database)        │     │  voice-emotion-recognition        │
│      Port: 5432                   │     │  Port: 8000 (internal)           │
│  - Users & Auth (BetterAuth)      │     │  - SpeechBrain wav2vec2-IEMOCAP  │
│  - Journals (video entries)       │     │  - FastAPI endpoints             │
│  - Transcripts                    │     │  - Audio emotion analysis        │
│  - Notes (hierarchical)           │     │                                   │
│  - Templates                      │     │                                   │
│  - Tags                           │     │                                   │
└───────────────────────────────────┘     └───────────────────────────────────┘

┌───────────────────┐
│  File Storage     │
│  (uploads/)       │
│  - Videos         │
│  - Thumbnails     │
│  - HLS segments   │
│  - Whisper models │
│  - face-api models│
└───────────────────┘
```

## Key Features

### Video Recording & Streaming
- Browser-based recording with MediaRecorder API
- Real-time streaming to server via fetch + ReadableStream
- Multi-codec support (VP9 for Chrome/Firefox/Edge, H.264 for Safari)
- Pause/resume support
- HLS transcoding for optimized playback

### AI-Powered Transcription
- OpenAI Whisper integration (whisper.cpp)
- 99 language support
- Timestamped segments for navigation
- Multiple model sizes (tiny to large-v3-turbo)
- Configurable per-user via settings

### Emotion Detection
- **Multimodal approach:** Combines facial and vocal analysis
- **Facial:** face-api.js with frame extraction (every 5 seconds)
- **Vocal:** Python SpeechBrain service with audio segments
- **Merging:** Weighted voting combines both modalities
- **Output:** 4 core emotions (neutral, happy, sad, angry)

### Notes System
- Hierarchical tree structure with drag-and-drop
- Templates for recurring formats
- Slash commands for quick creation
- Note-to-journal linking (many-to-many)
- Soft delete support

## Build Orchestration (Turborepo)

Turborepo manages build pipelines with the following tasks:

| Task | Description | Cached |
|------|-------------|--------|
| `build` | Build all packages in dependency order | Yes |
| `dev` | Start dev servers (persistent) | No |
| `lint` | Lint all packages | Yes |
| `test` | Run tests | Yes |
| `clean` | Remove build artifacts | No |

## TypeScript Configuration

The monorepo uses a shared TypeScript configuration:

- **Root `tsconfig.json`**: Base configuration shared by all packages
- **Package `tsconfig.json`**: Package-specific extends root config
- **Project References**: Enable cross-package type checking

## Package Management

**pnpm** is used as the package manager:

- Efficient disk space usage via content-addressable storage
- Strict dependency management prevents phantom dependencies
- Workspace protocol (`workspace:*`) for intra-monorepo dependencies

## Development Workflow

1. **Make changes** to any package
2. **Run `pnpm dev`** to start all dev servers with hot reload
3. **Type checking** is enforced across package boundaries
4. **Build** compiles TypeScript and bundles outputs
5. **Docker changes** require `docker compose up -d --build`

## Future Considerations

- Add API gateway/proxy for development
- Implement CI/CD pipeline
- Add end-to-end testing
- Configure deployment targets
- Add monitoring and observability
- Consider message queue (RabbitMQ/Redis Streams) for job processing
