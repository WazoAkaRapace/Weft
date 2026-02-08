# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Weft project.

## Workflows

### 1. Backend Tests (`backend-tests.yml`)

Runs backend (server) tests with PostgreSQL database.

**Triggers:**
- Push to `main` or `init` branches (backend-related files)
- Pull requests to `main` or `init` branches (backend-related files)

**Features:**
- PostgreSQL 16 service container
- Sharded test execution (2 shards) for faster runs
- Coverage reporting with Codecov
- Coverage thresholds: 80% for all metrics

**Environment:**
- Node.js 20
- PostgreSQL 16 Alpine
- pnpm package manager

**Test Matrix:**
- 2 parallel shards for faster execution

### 2. Frontend Tests (`frontend-tests.yml`)

Runs frontend (web) tests including unit/integration and E2E tests.

**Triggers:**
- Push to `main` or `init` branches (frontend-related files)
- Pull requests to `main` or `init` branches (frontend-related files)

**Features:**
- Unit/integration tests with Vitest
- E2E tests with Playwright (Chromium, Firefox, WebKit)
- Coverage reporting with Codecov
- Screenshots and traces on failure

**Environment:**
- Node.js 20
- Playwright browsers
- pnpm package manager

**Test Jobs:**
1. Unit & Integration Tests (Vitest)
2. E2E Tests (Playwright)
3. Coverage Summary

### 3. Test Suite (`test-suite.yml`)

Comprehensive test suite that runs all tests together.

**Triggers:**
- Push to `main` or `init` branches
- Pull requests to `main` or `init` branches
- Manual workflow dispatch

**Features:**
- Complete CI/CD validation
- Linting (ESLint) for all packages
- Backend tests with PostgreSQL
- Frontend unit/integration tests
- Frontend E2E tests
- Coverage reporting for all tests
- Test summary with status badges

**Test Jobs:**
1. Lint Code (ESLint)
2. Backend Tests
3. Frontend Unit Tests
4. Frontend E2E Tests
5. Test Summary

### 4. Docker Build and Push (`docker-build-push.yml`)

Builds and pushes Docker images to GitHub Container Registry.

**Triggers:**
- Push to `main` branch

**Images Built:**
- `weft-frontend` (React + Vite + nginx)
- `weft-backend` (Node.js backend with ML dependencies)
- `weft-voice-emotion` (Python SpeechBrain service)

**Tags:**
- `latest`
- `<branch>-<short-sha>` (e.g., `main-abc1234`)

## Environment Variables

### Backend Tests
- `NODE_ENV=test`
- `DATABASE_URL` (PostgreSQL connection string)
- `PORT=3001`
- `BETTER_AUTH_SECRET` (test secret key)
- `BETTER_AUTH_URL=http://localhost:3001`
- `BETTER_AUTH_APP_URL=http://localhost:3000`

### Frontend Tests
- `NODE_ENV=test`
- `VITE_API_URL=http://localhost:3001`

## Secrets

The following secrets should be configured in your GitHub repository:

- `CODECOV_TOKEN` (optional) - For uploading coverage reports to Codecov

## Coverage Thresholds

### Backend
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

### Frontend
- Lines: 70%
- Functions: 70%
- Branches: 60%
- Statements: 70%

## Artifacts

Test workflows upload the following artifacts:

### Backend
- `backend-coverage-report-shard-*` - Coverage reports for each shard
- Retention: 7 days

### Frontend
- `frontend-unit-coverage-report` - Unit test coverage
- `playwright-report` - Playwright HTML report
- `playwright-screenshots` - Screenshots on failure
- `playwright-traces` - Traces on failure
- Retention: 7 days

## Caching

Workflows use caching for faster builds:

- **pnpm store cache** - Cached based on `pnpm-lock.yaml`
- **Node modules cache** - Cached based on lockfile

## Concurrency

All workflows use concurrency control to prevent duplicate runs:

- `backend-tests-${{ github.ref }}`
- `frontend-tests-${{ github.ref }}`
- `test-suite-${{ github.ref }}`

## Local Testing

To run tests locally (same as CI):

```bash
# Backend tests
pnpm --filter @weft/server test:ci

# Frontend unit tests
pnpm --filter @weft/web test:run --coverage

# Frontend E2E tests
pnpm --filter @weft/web test:e2e

# All tests
pnpm test
```

## Troubleshooting

### Tests fail in CI but pass locally

1. Check environment variables match
2. Ensure PostgreSQL is running for backend tests
3. Verify Node.js version (should be 20)
4. Check for timezone/locale differences

### Coverage not uploading

1. Verify `CODECOV_TOKEN` is set in repository secrets
2. Check coverage file paths are correct
3. Ensure coverage reports are generated

### Playwright tests failing

1. Check if browsers are installed: `pnpm exec playwright install`
2. Verify `baseURL` in Playwright config matches test environment
3. Check if dev server is running for E2E tests
4. Review screenshots and traces in artifacts

## Best Practices

1. **Run tests locally before pushing** to catch issues early
2. **Keep tests fast** - use mocking and stubbing where appropriate
3. **Maintain coverage thresholds** - don't let coverage drop below targets
4. **Review test failures** - fix failing tests before merging
5. **Use workflow artifacts** - download screenshots/traces to debug failures
