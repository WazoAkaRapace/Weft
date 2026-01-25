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

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @weft/shared test
```

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
