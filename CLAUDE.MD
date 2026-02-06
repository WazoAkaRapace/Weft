# Weft Development Guide

This is a monorepo built with **Turborepo** and **pnpm** for a video journaling application using PostgreSQL and Drizzle ORM.

## Project Structure

```
Weft/
├── packages/
│   ├── server/      # Backend API (Node.js runtime)
│   ├── web/         # Frontend (React + Vite)
│   └── shared/      # Shared types and utilities
├── package.json     # Root package.json
└── turbo.json       # Turborepo configuration
```

## Available Commands

### Root Commands (run from project root)

```bash
# Build all packages
pnpm build

# Start development servers for all packages
pnpm dev

# Lint all packages
pnpm lint

# Run tests in all packages
pnpm test

# Clean build artifacts and node_modules
pnpm clean

# Format code with Prettier
pnpm format
```

### Server Commands (`@weft/server`)

```bash
# Run specific server commands
pnpm --filter @weft/server <command>

# Start development server (with hot reload)
pnpm --filter @weft/server dev

# Build for production
pnpm --filter @weft/server build

# Start production server
pnpm --filter @weft/server start

# Run tests
pnpm --filter @weft/server test

# Lint code
pnpm --filter @weft/server lint
```

### Web Commands (`@weft/web`)

```bash
# Run specific web commands
pnpm --filter @weft/web <command>

# Start development server
pnpm --filter @weft/web dev

# Build for production
pnpm --filter @weft/web build

# Preview production build
pnpm --filter @weft/web preview

# Lint code
pnpm --filter @weft/web lint
```

### Database Commands

```bash
# Generate migration files from schema changes
pnpm --filter @weft/server db:generate

# Apply pending migrations to database
pnpm --filter @weft/server db:migrate

# Push schema directly (development only - DO NOT USE IN PRODUCTION)
pnpm --filter @weft/server db:push

# Open Drizzle Studio (visual database inspector)
pnpm --filter @weft/server db:studio

# Seed database with sample data
pnpm --filter @weft/server db:seed
```

### Docker Commands

**IMPORTANT: After making backend changes, always rebuild and restart the Docker container using:**

```bash
# Rebuild and restart specific service(s)
docker compose -f docker/docker-compose.yml up -d --build <service-name>

# Examples:
docker compose -f docker/docker-compose.yml up -d --build backend
docker compose -f docker/docker-compose.yml up -d --build web
docker compose -f docker/docker-compose.yml up -d --build  # All services

# Rebuild and start all services
docker compose -f docker/docker-compose.yml up -d --build
```

**DO NOT use:** `docker restart <container>` - This will NOT apply code changes.

**Why:** The Docker image must be rebuilt to include new code changes. `docker restart` only restarts the existing container with old code.

## Important Database Guidelines

### CRITICAL: No Database Access During Development

**This project does NOT have access to a running database during development.**

When making database schema changes:

1. **Always use `db:generate`** to create migration files
   ```bash
   pnpm --filter @weft/server db:generate
   ```

2. **NEVER use `db:migrate` or `db:push`** - these will fail as there is no database connection

3. **NEVER use `db:studio`** - this requires a running database

4. **Review generated migration files** in `packages/server/drizzle/` to ensure they are correct

5. **Migrations will be applied** by the DevOps/infrastructure team when deployed to staging/production

### Migration Workflow

```bash
# 1. Modify schema in packages/server/src/db/schema.ts

# 2. Generate migration (creates SQL file in packages/server/drizzle/)
pnpm --filter @weft/server db:generate

# 3. Review the generated migration file

# 4. Commit the migration file with your changes
git add packages/server/drizzle/
git commit -m "feat: add new table/column"
```

## Package Manager

This project uses **pnpm** as the package manager.

```bash
# Install dependencies
pnpm install

# Add a dependency to a specific package
pnpm --filter @weft/server add <package>
pnpm --filter @weft/web add <package>

# Add a dev dependency
pnpm --filter @weft/server add -D <package>
```

## Environment Variables

Create a `.env.local` file in the appropriate package directory:

**Server (`packages/server/.env.local`):**
```bash
DATABASE_URL=postgresql://user:password@host:5432/weft
```

## Development Workflow

1. **Start development servers:**
   ```bash
   pnpm dev
   ```

2. **Make changes** to your code

3. **Format code:**
   ```bash
   pnpm format
   ```

4. **Lint and test:**
   ```bash
   pnpm lint
   pnpm test
   ```

5. **Build for production:**
   ```bash
   pnpm build
   ```

## Tech Stack

- **Runtime:** Node.js 20 (server and web)
- **Build Tool:** Turborepo
- **Package Manager:** pnpm
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Frontend:** React + Vite
- **Language:** TypeScript

## Additional Documentation

For more detailed project information, refer to the **[spec/](./spec/)** directory which contains:

- **Architecture** (`spec/ARCHITECTURE.md`) - Monorepo structure and design decisions
- **Setup Guide** (`spec/SETUP.md`) - Detailed setup and development instructions
- **Database** (`spec/DATABASE.md`) - Database schema, operations, and migrations
- **Docker** (`spec/DOCKER.md`) - Docker configuration and development environment
- **Recording Feature** (`spec/RECORDING.md`) - Video recording implementation details
- **Transcription Feature** (`spec/TRANSCRIPTION.md`) - Speech-to-text transcription with Whisper
- **Emotion Detection** (`spec/EMOTION_DETECTION.md`) - Video emotion analysis service
- **Design System** (`spec/DESIGN_SYSTEM.md`) - UI/UX guidelines and components
- **Contributing** (`spec/CONTRIBUTING.md`) - Contribution guidelines and code style

## External Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [pnpm Documentation](https://pnpm.io/)
