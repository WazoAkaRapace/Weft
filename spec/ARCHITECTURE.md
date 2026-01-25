# Weft Architecture

This document describes the architectural decisions and structure of the Weft monorepo.

## Monorepo Structure

```
weft/
├── packages/
│   ├── web/          # Frontend application (React + Vite)
│   ├── server/       # Backend server (Bun/Runtime)
│   └── shared/       # Shared utilities, types, and constants
├── turbo.json         # Turborepo configuration
├── pnpm-workspace.yaml # pnpm workspace configuration
├── package.json       # Root package.json
└── tsconfig.json      # Shared TypeScript configuration
```

## Packages

### `@weft/web`

The frontend application built with React and Vite.

**Responsibilities:**
- User interface
- Client-side routing
- State management
- API consumption

**Tech Stack:**
- React 19
- TypeScript 5
- Vite 6

**Port:** 3000

### `@weft/server`

The backend server.

**Responsibilities:**
- API endpoints
- Business logic
- Data persistence
- Authentication/authorization

**Tech Stack:**
- TypeScript 5
- Bun runtime (configurable to Node.js)

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
import { greet, APP_NAME } from '@weft/shared';
```

## Dependency Graph

```
@weft/web ─────> @weft/shared
@weft/server ──> @weft/shared
```

- `web` and `server` depend on `shared`
- `web` and `server` are independent of each other
- This enables independent deployment and development

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
5. **Test** runs unit tests across all packages

## Future Considerations

- Add API gateway/proxy for development
- Implement CI/CD pipeline
- Add end-to-end testing
- Configure deployment targets
- Add monitoring and observability
