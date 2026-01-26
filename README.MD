# Weft

A modern video journaling application built as a monorepo with Turborepo and pnpm.

## Overview

Weft is a video journaling platform that allows users to create, manage, and search through video journal entries with automatic transcription and tagging capabilities. The application features real-time video streaming, browser-based recording, and comprehensive search functionality.

## Features

- **Video Recording**: Record video journals directly in the browser with real-time streaming to the server
- **Automatic Transcription**: AI-powered transcription with timestamped segments
- **Tag-Based Organization**: Organize journals with custom tags for easy retrieval
- **Full-Text Search**: Search across journal titles and transcript content
- **User Authentication**: Secure authentication with session management
- **Responsive UI**: Modern React-based interface with Vite

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Vite 6** - Build tool and dev server
- **Bun Runtime** - Optimize performance

### Backend
- **Bun Runtime** - High-performance JavaScript runtime
- **TypeScript 5** - Type safety
- **Drizzle ORM** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage

### Infrastructure
- **Turborepo** - Monorepo build orchestration
- **pnpm** - Fast, disk space efficient package manager
- **Docker** - Containerized development environment

## Project Structure

```
Weft/
├── packages/
│   ├── web/          # Frontend application (React + Vite)
│   ├── server/       # Backend API (Bun runtime)
│   └── shared/       # Shared types and utilities
├── spec/             # Detailed project documentation
├── docker/           # Docker configuration
├── package.json      # Root package.json
├── turbo.json        # Turborepo configuration
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **PostgreSQL** (for local development)
- **Redis** (for local development)

### Installation

```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm@latest

# Install dependencies
pnpm install
```

### Development

```bash
# Start all development servers
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **Server**: http://localhost:3001

### Docker Development

```bash
# Start all services with Docker Compose
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop services
docker compose -f docker/docker-compose.yml down
```

## Available Commands

### Root Commands

```bash
# Build all packages
pnpm build

# Start development servers
pnpm dev

# Lint all packages
pnpm lint

# Run tests
pnpm test

# Clean build artifacts
pnpm clean

# Format code
pnpm format
```

### Database Commands

```bash
# Generate migration files
pnpm --filter @weft/server db:generate

# Apply migrations
pnpm --filter @weft/server db:migrate

# Push schema (development only)
pnpm --filter @weft/server db:push

# Open Drizzle Studio
pnpm --filter @weft/server db:studio

# Seed database
pnpm --filter @weft/server db:seed
```

### Package-Specific Commands

```bash
# Server commands
pnpm --filter @weft/server <command>

# Web commands
pnpm --filter @weft/web <command>

# Shared commands
pnpm --filter @weft/shared <command>
```

## Documentation

For detailed project documentation, see the [spec/](./spec/) directory:

- **[Architecture](./spec/ARCHITECTURE.md)** - Monorepo structure and design decisions
- **[Setup Guide](./spec/SETUP.md)** - Detailed setup and development instructions
- **[Database](./spec/DATABASE.md)** - Database schema and operations
- **[Docker](./spec/DOCKER.md)** - Docker configuration and usage
- **[Recording Feature](./spec/RECORDING.md)** - Video recording implementation details
- **[Contributing](./spec/CONTRIBUTING.md)** - Contribution guidelines

## Development Workflow

1. Make changes to any package
2. Run `pnpm dev` to start dev servers with hot reload
3. Type checking is enforced across package boundaries
4. Build compiles TypeScript and bundles outputs
5. Run tests and linting before committing

## Environment Variables

Create a `.env.local` file in the appropriate package directory:

**Server (`packages/server/.env.local`):**
```bash
DATABASE_URL=postgresql://user:password@host:5432/weft
```

See [spec/DATABASE.md](./spec/DATABASE.md) for complete environment variable reference.

## Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | VP9 codec recommended |
| Firefox | 88+ | VP9 codec recommended |
| Safari | 14.1+ | H.264 codec required |
| Edge | 90+ | VP9 codec recommended |

## Contributing

We welcome contributions! Please see [spec/CONTRIBUTING.md](./spec/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License.

## Support

For questions, issues, or feature requests, please open an issue on the project repository.
