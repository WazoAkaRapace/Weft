# Weft

<p align="center">
  <img src="assets/logo-light.svg" alt="Weft Logo" width="128" height="128">
</p>

> [!WARNING]
> **This project is under heavy development.** APIs, architecture, and features are subject to change without notice. Not recommended for production use.

<div align="center">
  <h3>Enhanced video journaling</h3>
  <p>Record, transcribe, and analyze your video journals with automatic emotion detection</p>
</div>

## Screenshots

![Dashboard](screenshots/01-dashboard.png)
![Notes](screenshots/02-notes.png)
![Recording](screenshots/03-recording.png)
![Mood Calendar](screenshots/06-mood-calendar.png)
![Journal Detail](screenshots/05-journal-detail.png)

## Features

- **Video Recording** - Browser-based with real-time streaming, pause/resume, multi-codec support (VP9/H.264)
- **AI Transcription** - OpenAI Whisper, 99 languages, timestamped segments, full-text search
- **Emotion Detection** - Multimodal (facial + vocal) analysis with real-time timeline visualization
- **Mood Tracking** - Daily mood calendar with morning/afternoon tracking, 11 emotion options, notes, and statistics
- **Notes System** - Hierarchical organization, templates, slash commands, markdown editing
- **HLS Video Playback** - With transcript sync and emotion analysis per entry
- **Authentication** - BetterAuth with database session management

## Tech Stack

| Frontend | Backend | AI/ML | Infrastructure |
|----------|---------|-------|----------------|
| React 19 | Node.js 20 | OpenAI Whisper | Turborepo |
| TypeScript 5.7 | Drizzle ORM | face-api.js | pnpm |
| Vite 6 | PostgreSQL 16 | SpeechBrain | Docker |
| HLS.js | BetterAuth | FFmpeg | |

## Quick Start

### Option 1: Docker Compose (Recommended)

**Using pre-built images from GitHub Container Registry:**
```bash
docker compose -f docker/docker-compose.registry.yml up -d
```

**Building locally:**
```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Visit http://localhost:3000

### Option 2: Local Development

**Prerequisites:**
- Node.js 20+
- pnpm
- PostgreSQL 16
- FFmpeg
- Python 3.11 (for voice emotion service)

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

Visit http://localhost:3000

## Commands

### Docker Commands
```bash
# Start all services
docker compose -f docker/docker-compose.yml up -d

# Rebuild and restart specific service(s)
docker compose -f docker/docker-compose.yml up -d --build backend

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop services
docker compose -f docker/docker-compose.yml down
```

### Local Development Commands
```bash
# Build all packages
pnpm build

# Start development servers
pnpm dev

# Generate database migrations
pnpm --filter @weft/server db:generate

# Run linting
pnpm lint

# Run tests
pnpm test
```

## Environment Variables

**Server (`.env.local`)**
```bash
DATABASE_URL=postgresql://user:password@host:5432/weft
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

For Docker deployments, see [spec/DOCKER.md](./spec/DOCKER.md) for the full list of environment variables.

## Documentation

- [Architecture](./spec/ARCHITECTURE.md) - Monorepo structure
- [Docker](./spec/DOCKER.md) - Docker configuration and deployment
- [Recording Feature](./spec/RECORDING.md) - Video recording implementation
- [Transcription](./spec/TRANSCRIPTION.md) - AI transcription details
- [Emotion Detection](./spec/EMOTION_DETECTION.md) - Multimodal emotion analysis
