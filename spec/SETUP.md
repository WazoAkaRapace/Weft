# Weft Setup Guide

This guide will help you set up the Weft monorepo on your local machine.

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Git**

## Installation

### 1. Install pnpm (if not already installed)

```bash
npm install -g pnpm@latest
```

### 2. Install dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo and all packages.

## Development

### Start all packages in development mode

```bash
pnpm dev
```

This will start:
- **Web**: Vite dev server on http://localhost:3000
- **Server**: Backend server on http://localhost:3001
- **Shared**: Watch mode for TypeScript compilation

### Start individual packages

```bash
# Web only
pnpm --filter @weft/web dev

# Server only
pnpm --filter @weft/server dev

# Shared only (watch mode)
pnpm --filter @weft/shared dev
```

## Building

### Build all packages

```bash
pnpm build
```

### Build individual packages

```bash
pnpm --filter @weft/web build
pnpm --filter @weft/server build
pnpm --filter @weft/shared build
```

## Testing

### Quick Tests (No Database)

Run frontend tests that don't require a database:

```bash
# Run web tests (unit tests only)
pnpm --filter @weft/web test

# Run with coverage
pnpm --filter @weft/web test:coverage
```

### Full Test Suite (With Database)

For complete testing including backend tests that require PostgreSQL:

```bash
# Run all tests with automatic database setup
pnpm test:local

# Run with coverage
pnpm test:local:ci

# Run only backend tests
pnpm test:local:backend

# Run only frontend tests
pnpm test:local:frontend
```

The test database is automatically started in Docker and stopped after tests complete.

### Backend Tests Only

For backend development, use server-specific test commands:

```bash
# From packages/server directory
cd packages/server

# Run backend tests with database
pnpm test:local

# Run with coverage
pnpm test:local:ci

# Keep database running after tests
pnpm test:local:keep
```

See [DATABASE.md](DATABASE.md#local-testing) for more database testing options.

## Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @weft/web lint
```

## Clean

Remove build artifacts and node_modules:

```bash
# Clean all packages
pnpm clean

# Clean specific package
pnpm --filter @weft/web clean
```

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript Vue Plugin (if using Vue)

### WebStorm / IntelliJ IDEA

- Enable TypeScript service
- Enable ESLint
- Enable Prettier

## Troubleshooting

### Dependencies not linking correctly

If workspace dependencies aren't resolving:

```bash
rm -rf node_modules packages/*/node_modules
pnpm install
```

### Port already in use

If ports 3000 or 3001 are already in use, you can modify the port in:
- `packages/web/vite.config.ts` (web)
- `packages/server/src/index.ts` (server)

### Turbo cache issues

```bash
rm -rf .turbo
pnpm build
```
