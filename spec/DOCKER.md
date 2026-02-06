# Weft Docker Setup

Complete Docker Compose configuration for local development environment with PostgreSQL, Frontend, Backend, and Voice Emotion Recognition services.

## Table of Contents

- [Quick Start](#quick-start)
- [Using Pre-built Images from Registry](#using-pre-built-images-from-registry)
- [Prerequisites](#prerequisites)
- [Services](#services)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Start all services
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop services
docker compose -f docker/docker-compose.yml down
```

## Using Pre-built Images from Registry

Weft publishes pre-built Docker images to the GitHub Container Registry (ghcr.io). These images are built automatically on every push to the `main` branch.

### Available Images

| Image | Registry | Tags |
|-------|----------|------|
| Frontend | `ghcr.io/wazoakarapace/weft-frontend` | `latest`, `main-<sha>` |
| Backend | `ghcr.io/wazoakarapace/weft-backend` | `latest`, `main-<sha>` |
| Voice Emotion | `ghcr.io/wazoakarapace/weft-voice-emotion` | `latest`, `main-<sha>` |

### Quick Start with Registry Images

```bash
# Start all services using pre-built images
docker compose -f docker/docker-compose.registry.yml up -d

# View logs
docker compose -f docker/docker-compose.registry.yml logs -f

# Stop services
docker compose -f docker/docker-compose.registry.yml down
```

### Pulling Specific Image Versions

To use a specific version instead of `latest`, modify the `docker-compose.registry.yml` file:

```yaml
services:
  frontend:
    image: ghcr.io/wazoakarapace/weft-frontend:main-abc1234
  backend:
    image: ghcr.io/wazoakarapace/weft-backend:main-abc1234
  voice-emotion-recognition:
    image: ghcr.io/wazoakarapace/weft-voice-emotion:main-abc1234
```

### Manual Image Pull

```bash
# Pull latest images
docker pull ghcr.io/wazoakarapace/weft-frontend:latest
docker pull ghcr.io/wazoakarapace/weft-backend:latest
docker pull ghcr.io/wazoakarapace/weft-voice-emotion:latest

# Pull specific version
docker pull ghcr.io/wazoakarapace/weft-frontend:main-abc1234
```

### Registry vs Local Build

| Feature | Local Build (`docker-compose.yml`) | Registry (`docker-compose.registry.yml`) |
|---------|-----------------------------------|------------------------------------------|
| Build Time | ~10-20 minutes | None (pre-built) |
| Use Case | Development with code changes | Quick deployment, testing |
| Image Source | Built from source | ghcr.io |
| Flexibility | Can test uncommitted changes | Only committed changes |

### GitHub Actions CI/CD

Images are automatically built and pushed by the GitHub Actions workflow (`.github/workflows/docker-build-push.yml`):

- **Trigger:** Push to `main` branch
- **Builds:** Frontend, Backend, Voice Emotion Recognition
- **Tags:** `latest` + git SHA
- **Visibility:** Public (no authentication required for pulling)

## Prerequisites

- **Docker Engine** 24.0+
- **Docker Compose** v2.0+
- **Disk Space**: ~4GB for images and volumes

### Check Installation

```bash
docker --version
docker compose version
```

## Services

### Frontend (`frontend`)

| Setting | Value |
|---------|-------|
| Image | Built from `packages/web/Dockerfile` |
| Port | `3000` |
| Health Check | HTTP `GET /` |

**Features:**
- Multi-stage build (production target)
- Nginx serving static files
- Health checks for service readiness

### Backend (`backend`)

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20 |
| Port | `3001` |
| Health Check | HTTP `GET /` |
| Memory Limit | 16GB / Reserve 2GB |

**Features:**
- Multi-stage build for optimization
- Health checks
- Voice emotion detection integration
- Whisper transcription support
- FFmpeg for video/audio processing

**Dependencies:**
- PostgreSQL (`db`)
- Voice Emotion Recognition service

### PostgreSQL 16 (`db`)

| Setting | Value |
|---------|-------|
| Image | `postgres:16-alpine` |
| Port | `5432` |
| User | `weft` |
| Password | `weft_dev_password` |
| Database | `weft` |
| Volume | `weft_postgres_data` |

**Optimized Settings:**
- Max connections: 200
- Shared buffers: 256MB
- Effective cache size: 1GB
- Maintenance work mem: 64MB

### Voice Emotion Recognition (`voice-emotion-recognition`)

| Setting | Value |
|---------|-------|
| Image | Built from `services/voice-emotion-recognition/Dockerfile` |
| Port | `8000` (internal) |
| Health Check | HTTP `GET /health` |
| Volume | `weft_voice_emotion_models` |

**Features:**
- Python FastAPI service
- SpeechBrain wav2vec2-IEMOCAP model
- Automatic model download on first start (~300MB)
- Startup time: 1-2 minutes on first run

## Configuration

### Environment Variables

**Backend:**
```bash
PORT=3001
DATABASE_URL=postgresql://weft:weft_dev_password@db:5432/weft
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
VOICE_EMOTION_API_URL=http://voice-emotion-recognition:8000
TRANSCRIPTION_WORKER_CONCURRENCY=1
```

**PostgreSQL:**
```bash
POSTGRES_USER=weft
POSTGRES_PASSWORD=weft_dev_password
POSTGRES_DB=weft
POSTGRES_PORT=5432
```

### Custom Ports

To avoid port conflicts, create a `.env` file in the project root:

```bash
POSTGRES_PORT=15432
FRONTEND_PORT=3000
BACKEND_PORT=3001
```

## Usage

### Starting Services

```bash
# Start all services in detached mode
docker compose -f docker/docker-compose.yml up -d

# Start specific service
docker compose -f docker/docker-compose.yml up -d db

# Start with log output
docker compose -f docker/docker-compose.yml up
```

### Stopping Services

```bash
# Stop all services (preserve volumes)
docker compose -f docker/docker-compose.yml down

# Stop and remove volumes (⚠️ deletes data)
docker compose -f docker/docker-compose.yml down -v
```

### Viewing Logs

```bash
# All services
docker compose -f docker/docker-compose.yml logs -f

# Specific service
docker compose -f docker/docker-compose.yml logs -f backend

# Last 100 lines
docker compose -f docker/docker-compose.yml logs --tail=100 backend
```

### Executing Commands

```bash
# Access PostgreSQL
docker compose -f docker/docker-compose.yml exec db psql -U weft -d weft

# Access backend shell
docker compose -f docker/docker-compose.yml exec backend sh

# Check voice emotion service health
docker compose -f docker/docker-compose.yml exec voice-emotion-recognition curl http://localhost:8000/health
```

### Rebuilding Images

**IMPORTANT:** After making code changes, always rebuild and restart:

```bash
# Rebuild specific service
docker compose -f docker/docker-compose.yml up -d --build backend

# Rebuild all services
docker compose -f docker/docker-compose.yml up -d --build

# Rebuild without cache
docker compose -f docker/docker-compose.yml build --no-cache backend
```

⚠️ **DO NOT use** `docker restart <container>` - This will NOT apply code changes.

## Development Workflow

### Database Operations

```bash
# Generate migration
docker compose -f docker/docker-compose.yml exec backend node packages/server/dist/db.js generate

# Apply migrations
docker compose -f docker/docker-compose.yml exec backend node packages/server/dist/db.js migrate

# Push schema (development only)
docker compose -f docker/docker-compose.yml exec backend node packages/server/dist/db.js push

# Seed database
docker compose -f docker/docker-compose.yml exec backend node packages/server/dist/db.js seed
```

**Note:** For local development (outside Docker), use `pnpm --filter @weft/server db:generate` instead.

### Resetting Environment

```bash
# Complete reset (⚠️ deletes all data)
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml exec backend node packages/server/dist/db.js migrate
```

### Connecting from Host

**Frontend:**
```bash
# Access in browser
open http://localhost:3000
```

**Backend API:**
```bash
# Test health endpoint
curl http://localhost:3001/

# Example API call (requires auth)
curl http://localhost:3001/api/journals
```

**PostgreSQL:**
```bash
# Using psql
psql -h localhost -p 5432 -U weft -d weft
```

## Troubleshooting

### Service Won't Start

**Issue:** Ports already in use

```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :3000  # Frontend
lsof -i :3001  # Backend

# Solution: Change ports in .env
POSTGRES_PORT=15432
FRONTEND_PORT=3001
BACKEND_PORT=3002
```

**Issue:** Container exits immediately

```bash
# Check logs
docker compose -f docker/docker-compose.yml logs backend

# Common fix: Rebuild image
docker compose -f docker/docker-compose.yml up -d --build backend
```

### Database Connection Issues

**Issue:** Backend can't connect to database

```bash
# Verify database is healthy
docker compose -f docker/docker-compose.yml ps db

# Check database logs
docker compose -f docker/docker-compose.yml logs db

# Verify connection from backend container
docker compose -f docker/docker-compose.yml exec backend sh
# In container: wget -O- http://db:5432
```

### Voice Emotion Service Issues

**Issue:** Voice emotion detection not working

```bash
# Check service health
docker compose -f docker/docker-compose.yml logs voice-emotion-recognition

# Verify health check
curl http://localhost:8000/health

# Common issue: Model download takes 1-2 minutes on first start
# Check logs for download progress
docker compose -f docker/docker-compose.yml logs -f voice-emotion-recognition
```

### Memory Issues

**Issue:** Backend out of memory

The backend has a 16GB memory limit for Whisper transcription:

```bash
# Check container memory usage
docker stats weft-backend

# If needed, increase limit in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 20G  # Increase from 16G
```

### Health Checks Failing

```bash
# Check health status
docker compose -f docker/docker-compose.yml ps

# Manual health check
docker compose -f docker/docker-compose.yml exec backend wget -O- http://localhost:3001/
```

### Code Changes Not Applied

**Issue:** Changes not showing up

```bash
# ALWAYS rebuild after code changes
docker compose -f docker/docker-compose.yml up -d --build backend

# For frontend changes
docker compose -f docker/docker-compose.yml up -d --build frontend
```

## Volumes

| Volume | Purpose |
|--------|---------|
| `weft_postgres_data` | PostgreSQL data persistence |
| `weft_uploads_data` | User uploads (videos, models) |
| `weft_voice_emotion_models` | SpeechBrain model cache |

### Managing Volumes

```bash
# List volumes
docker volume ls | grep weft

# Remove specific volume (⚠️ deletes data)
docker volume rm weft_postgres_data

# Backup postgres volume
docker run --rm -v weft_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Network

All services communicate via `weft-network` bridge network.

```bash
# Inspect network
docker network inspect weft-network

# Services can reach each other by container name:
# - db (PostgreSQL)
# - backend (Node.js API)
# - frontend (Nginx)
# - voice-emotion-recognition (Python API)
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Images](https://hub.docker.com/_/postgres)
- [Node.js Documentation](https://nodejs.org/docs)
- [Project Architecture](./ARCHITECTURE.md)
- [Database Documentation](./DATABASE.md)
- [Emotion Detection Feature](./EMOTION_DETECTION.md)
