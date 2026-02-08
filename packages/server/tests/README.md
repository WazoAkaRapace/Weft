# Backend Test Suite

This directory contains the test suite for the Weft backend API.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions and classes
│   ├── services/      # Service layer tests (transcription, emotion, etc.)
│   ├── queues/        # Queue system tests
│   └── lib/           # Library tests (auth, helpers)
├── integration/       # Integration tests for API routes and database
│   ├── routes/        # API endpoint tests
│   └── database/      # Database schema and operation tests
├── fixtures/          # Test data helpers and fixtures
│   ├── auth.ts        # Authentication fixtures
│   ├── db.ts          # Database fixtures
│   └── videos.ts      # Video/file fixtures
└── setup.ts           # Global test configuration
```

## Setup

### Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Set up test environment variables:
```bash
cp .env.test.example .env.test
# Edit .env.test with your test database configuration
```

3. Ensure test database exists:
```bash
# Using psql
createdb weft_test

# Or use Docker
docker exec -i <postgres-container> psql -U postgres -c "CREATE DATABASE weft_test;"
```

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run tests once
```bash
pnpm test:run
```

### Run tests in watch mode
```bash
pnpm test:watch
```

### Run tests with coverage
```bash
pnpm test:ci
```

### Run specific test file
```bash
pnpm tests/integration/database/schema.test.ts
```

## Test Isolation

Tests use database transactions for isolation:

1. **Before each test**: A transaction is started
2. **Test execution**: All database operations happen within the transaction
3. **After each test**: Transaction is rolled back, reverting all changes

This ensures tests don't interfere with each other and provides clean state for each test.

## Fixtures

### Authentication Fixtures

```typescript
import { createTestUser, createTestSession, createAuthenticatedUser } from './fixtures/auth.js';

// Create a test user
const user = await createTestUser({ email: 'test@example.com' });

// Create a test session
const session = await createTestSession(user.id);

// Create both at once
const { user, session } = await createAuthenticatedUser();
```

### Database Fixtures

```typescript
import { createTestJournal, createTestNote, linkNoteToJournal } from './fixtures/db.js';

// Create a test journal
const journal = await createTestJournal(userId, { title: 'My Journal' });

// Create a test note
const note = await createTestNote(userId, { title: 'My Note' });

// Link them together
await linkNoteToJournal(note.id, journal.id);
```

### Video Fixtures

```typescript
import { createTestVideoFile, createTestThumbnailFile, createMockVideoStream } from './fixtures/videos.js';

// Create a test video file
const videoPath = await createTestVideoFile();

// Create a test thumbnail
const thumbnailPath = await createTestThumbnailFile();

// Create a mock video stream
const stream = createMockVideoStream(5, 1024); // 5 chunks of 1KB each
```

## Writing Tests

### Unit Tests

Unit tests should test individual functions and classes in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { TranscriptionService } from '../../src/services/transcription.js';

describe('TranscriptionService', () => {
  it('should parse SRT output correctly', () => {
    const service = new TranscriptionService();
    // Test implementation...
  });
});
```

### Integration Tests

Integration tests should test API endpoints and database operations:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestUser } from '../fixtures/auth.js';
import { handleGetJournals } from '../../src/routes/journals.js';

describe('GET /api/journals', () => {
  beforeEach(async () => {
    // Setup test data
    await createTestUser();
  });

  it('should return user journals', async () => {
    // Test implementation...
  });
});
```

### Mocking External Services

Use Vitest's built-in mocking for external dependencies:

```typescript
import { vi, describe, it, expect } from 'vitest';

vi.mock('nodejs-whisper', () => ({
  nodewhisper: vi.fn(() => Promise.resolve('Test transcript')),
}));

describe('TranscriptionService', () => {
  it('should call nodejs-whisper', async () => {
    // Test will use the mocked implementation
  });
});
```

## Coverage Targets

| Category | Target |
|----------|--------|
| Routes (integration) | 90% |
| Services (unit) | 85% |
| Queues (unit) | 90% |
| Lib/auth (unit) | 80% |
| **Overall** | **80%+** |

## CI/CD

Tests run automatically on GitHub Actions. See `.github/workflows/test.yml` for configuration.

## Troubleshooting

### Database connection errors

Ensure the test database is running and accessible:
```bash
# Test connection
psql -h localhost -U postgres -d weft_test
```

### Port already in use

Ensure the development server isn't running when running tests, or configure tests to use a different port.

### Cleanup issues

If test files/directories aren't cleaned up properly:
```bash
# Manually remove test uploads
rm -rf test-uploads/
```

## Contributing

When adding new tests:

1. Follow the existing structure and naming conventions
2. Use descriptive test names that explain what is being tested
3. Group related tests using `describe` blocks
4. Use fixtures for reusable test data
5. Ensure tests are isolated and don't depend on execution order
6. Mock external dependencies (AI services, file system)
7. Aim for high coverage but prioritize meaningful tests over coverage percentage
