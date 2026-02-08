# Weft Database Documentation

This document describes the database schema, architecture, and management for the Weft application using Drizzle ORM and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Schema Reference](#schema-reference)
- [Indices and Performance](#indices-and-performance)
- [Connection Pool Configuration](#connection-pool-configuration)
- [Migrations](#migrations)
- [Environment Variables](#environment-variables)
- [Database Operations](#database-operations)

## Overview

Weft uses **PostgreSQL** as the primary database, managed through **Drizzle ORM**. The database is designed to support a video journaling application with features including:

- User authentication and management (BetterAuth)
- Video journal entries with metadata
- Automatic transcription with timestamped segments
- Emotion detection (facial + vocal)
- Hierarchical note system with templates
- Tag-based organization and search
- HLS video streaming

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WEFT DATABASE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                            │
│  │    USERS     │                                                            │
│  ├──────────────┤                                                            │
│  │ id (PK)      │                                                            │
│  │ username     │                                                            │
│  │ email        │                                                            │
│  │ emailVerified│                                                            │
│  │ passwordHash │                                                            │
│  │ name         │                                                            │
│  │ image        │                                                            │
│  │ preferredLanguage │                                                      │
│  │ transcriptionModel│                                                     │
│  │ createdAt    │                                                            │
│  │ updatedAt    │                                                            │
│  └──────┬───────┘                                                            │
│         │                                                                     │
│         ├─── 1:N ───┐  1:N ──┐  1:N ──┐  1:N ──┐  1:N ──┐                   │
│         │           │        │        │        │        │                    │
│         ▼           ▼        ▼        ▼        ▼        ▼                    │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌──────────┐              │
│  │JOURNALS   │ │NOTES     │ │SESSIONS│ │TAGS   │ │TRANSCRIPTS│              │
│  ├──────────┤ ├──────────┤ ├────────┤ ├───────┤ ├──────────┤              │
│  │ id (PK)   │ │ id (PK)  │ │ id(PK) │ │ id(PK)│ │ id (PK)   │              │
│  │ userId(FK)│ │ userId(FK)│ │userId  │ │journal│ │ journalId │              │
│  │ title     │ │ title    │ │ expires│ │_Id    │ │ text      │              │
│  │ videoPath │ │ content  │ │ token  │ │ tag   │ │ segments  │              │
│  │ thumbnail │ │ parentId │ └────────┘ └───────┘ │ createdAt│              │
│  │ duration  │ │ position │                      └──────────┘              │
│  │ location  │ │ icon     │                                                 │
│  │ notes     │ │ color    │        ┌──────────────────┐                    │
│  │ manualMood│ │ deletedAt│        │ JOURNAL_NOTES    │                    │
│  │ dominant  │ │ createdAt│        ├──────────────────┤                    │
│  │ _Emotion  │ │ updatedAt│        │ journalId (FK)   │                    │
│  │ emotion   │ └──────────┘        │ noteId (FK)      │                    │
│  │ _Timeline │                     │ createdAt        │                    │
│  │ emotion   │                     └──────────────────┘                    │
│  │ _Scores   │                                                          │
│  │ hlsStatus │        ┌──────────────────┐                                │
│  │ createdAt │        │   TEMPLATES     │                                │
│  └──────────┘        ├──────────────────┤                                │
│                       │ id (PK)          │                                │
│                       │ userId (FK)      │                                │
│                       │ title            │                                │
│                       │ content          │                                │
│                       │ icon             │                                │
│                       │ color            │                                │
│                       │ createdAt        │                                │
│                       └──────────────────┘                                │
│                                                                             │
│  Legend:                                                                    │
│  ─────  FK (Foreign Key)                                                    │
│  PK    Primary Key                                                          │
│  1:N   One-to-Many relationship                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Schema Reference

### Users Table

Stores user account information with Better Auth integration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique user identifier |
| `username` | TEXT | UNIQUE | User's chosen username |
| `email` | TEXT | UNIQUE | User's email address |
| `emailVerified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Email verification status |
| `passwordHash` | TEXT | | Bcrypt hashed password |
| `name` | TEXT | | Display name |
| `image` | TEXT | | Profile image URL |
| `preferredLanguage` | TEXT | DEFAULT 'en' | Transcription language preference |
| `transcriptionModel` | TEXT | DEFAULT 'Xenova/whisper-small' | Whisper model preference |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indices:**
- `users_username_idx` on `username`
- `users_email_idx` on `email`
- `users_created_at_idx` on `createdAt`

---

### Sessions Table (Better Auth)

Stores user sessions for authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Session identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Session owner |
| `expiresAt` | TIMESTAMP | NOT NULL | Session expiration |
| `token` | TEXT | NOT NULL, UNIQUE | Session token |
| `ipAddress` | TEXT | | Client IP address |
| `userAgent` | TEXT | | Client user agent |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### Accounts Table (Better Auth)

Stores OAuth provider accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Account identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Account owner |
| `accountId` | TEXT | NOT NULL | Provider account ID |
| `providerId` | TEXT | NOT NULL | Provider identifier |
| `accessToken` | TEXT | | OAuth access token |
| `refreshToken` | TEXT | | OAuth refresh token |
| `idToken` | TEXT | | OAuth ID token |
| `expiresAt` | TIMESTAMP | | Token expiration |
| `password` | TEXT | | Provider password |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### Verifications Table (Better Auth)

Stores email verification and password reset tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Verification identifier |
| `identifier` | TEXT | NOT NULL | Email or identifier |
| `value` | TEXT | NOT NULL | Verification code/token |
| `expiresAt` | TIMESTAMP | NOT NULL | Expiration timestamp |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

---

### Journals Table

Stores video journal entries with emotion detection and HLS streaming support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique journal identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Journal owner |
| `title` | TEXT | NOT NULL | Journal title |
| `videoPath` | TEXT | NOT NULL | Video file path |
| `thumbnailPath` | TEXT | | Thumbnail image path |
| `duration` | INTEGER | NOT NULL | Duration in seconds |
| `location` | TEXT | | Optional location metadata |
| `notes` | TEXT | | Optional user notes |
| `manualMood` | TEXT | | User-set manual mood |
| `dominantEmotion` | TEXT | | Detected dominant emotion |
| `emotionTimeline` | JSONB | | Frame-by-frame emotions |
| `emotionScores` | JSONB | | Emotion distribution |
| `hlsManifestPath` | TEXT | | HLS master playlist path |
| `hlsStatus` | TEXT | | HLS transcoding status |
| `hlsError` | TEXT | | HLS error message |
| `hlsCreatedAt` | TIMESTAMP | | HLS completion time |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Emotion Timeline Type:**
```typescript
type EmotionTimelineEntry = {
  time: number;      // Timestamp in seconds
  emotion: string;   // happy, sad, angry, neutral
  confidence: number; // 0-1 confidence score
};
```

**Emotion Scores Type:**
```typescript
type EmotionScores = {
  happy: number;
  sad: number;
  angry: number;
  neutral: number;
};
```

**Indices:**
- `journals_user_id_idx` on `userId`
- `journals_created_at_idx` on `createdAt`
- `journals_title_idx` on `title`
- `journals_dominant_emotion_idx` on `dominantEmotion`

---

### Notes Table

Stores hierarchical notes with tree structure support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Note identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Note owner |
| `title` | TEXT | NOT NULL | Note title |
| `content` | TEXT | | Markdown content |
| `icon` | TEXT | DEFAULT '📝' | Visual icon |
| `color` | TEXT | | Hex color code |
| `parentId` | UUID | FK(notes.id) | Parent note for hierarchy |
| `position` | INTEGER | NOT NULL, DEFAULT 0 | Ordering within parent |
| `deletedAt` | TIMESTAMP | | Soft delete timestamp |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indices:**
- `notes_user_id_idx` on `userId`
- `notes_parent_id_idx` on `parentId`
- `notes_user_deleted_idx` on `(userId, deletedAt)`
- `notes_parent_position_idx` on `(parentId, position)`
- `notes_deleted_at_idx` on `deletedAt`

---

### Journal Notes Table

Junction table for many-to-many relationship between notes and journals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identifier |
| `noteId` | UUID | FK(notes.id), NOT NULL | Linked note |
| `journalId` | UUID | FK(journals.id), NOT NULL | Linked journal |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Constraints:**
- Unique on `(journalId, noteId)` - One note can only be linked to a journal once

**Indices:**
- `journal_notes_note_id_idx` on `noteId`
- `journal_notes_journal_id_idx` on `journalId`

---

### Templates Table

Stores user-specific note templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Template identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Template owner |
| `title` | TEXT | NOT NULL | Template title |
| `content` | TEXT | | Markdown template content |
| `icon` | TEXT | DEFAULT '📝' | Visual icon |
| `color` | TEXT | | Hex color code |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indices:**
- `templates_user_id_idx` on `userId`
- `templates_created_at_idx` on `createdAt`

---

### Transcripts Table

Stores automatic transcription data with timestamped segments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Transcript identifier |
| `journalId` | UUID | FK(journals.id), NOT NULL | Associated journal |
| `text` | TEXT | NOT NULL | Full transcript text |
| `segments` | JSONB | | Timestamped segments array |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Segments Type:**
```typescript
type TranscriptSegment = {
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  text: string;       // Segment text
  confidence?: number; // Optional confidence (0-1)
};
```

**Indices:**
- `transcripts_journal_id_idx` on `journalId`

---

### Tags Table

Stores tags for organizing journal entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Tag identifier |
| `journalId` | UUID | FK(journals.id), NOT NULL | Associated journal |
| `tag` | TEXT | NOT NULL | Tag text |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indices:**
- `tags_journal_id_idx` on `journalId`
- `tags_tag_idx` on `tag`
- `tags_journal_tag_idx` on `(journalId, tag)`

---

## Indices and Performance

### Index Strategy

| Index | Type | Purpose |
|-------|------|---------|
| `users_username_idx` | B-tree | Username authentication |
| `users_email_idx` | B-tree | Email lookups |
| `journals_user_id_idx` | B-tree | User's journal feed |
| `journals_created_at_idx` | B-tree | Chronological ordering |
| `journals_dominant_emotion_idx` | B-tree | Emotion filtering |
| `notes_user_deleted_idx` | Composite | Non-deleted notes query |
| `notes_parent_position_idx` | Composite | Tree ordering |
| `transcripts_journal_id_idx` | B-tree | Transcript retrieval |

---

## Connection Pool Configuration

### Pool Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `max` | 10 | Maximum connections |
| `idle_timeout` | 20s | Close idle connections |
| `connect_timeout` | 10s | Connection wait time |

---

## Migrations

### Generating Migrations

```bash
pnpm --filter @weft/server db:generate
```

### Applying Migrations

```bash
pnpm --filter @weft/server db:migrate
```

### Pushing Schema (Development Only)

```bash
pnpm --filter @weft/server db:push
```

⚠️ **Warning:** Only use `db:push` in development.

---

## Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:5432/weft
```

### Docker Compose

```bash
DATABASE_URL=postgresql://weft:weft_dev_password@db:5432/weft
```

---

## Database Operations

### Common Queries

#### Get User's Journals with Emotions

```typescript
const userJournals = await db
  .select()
  .from(journals)
  .where(eq(journals.userId, userId))
  .orderBy(desc(journals.createdAt));
```

#### Get Notes with Hierarchy

```typescript
const notes = await db
  .select()
  .from(notes)
  .where(
    and(
      eq(notes.userId, userId),
      isNull(notes.deletedAt)
    )
  )
  .orderBy(asc(notes.position));
```

#### Full-Text Search

```typescript
const results = await db
  .select({
    journal: journals,
    transcript: transcripts,
  })
  .from(journals)
  .innerJoin(transcripts, eq(journals.id, transcripts.journalId))
  .where(
    or(
      ilike(journals.title, `%${searchTerm}%`),
      ilike(transcripts.text, `%${searchTerm}%`)
    )
  );
```

---

## Best Practices

### Development
1. Use migrations for schema changes
2. Use `db:push` for rapid prototyping only
3. Check connection pool settings

### Production
1. Always use migrations - never `db:push`
2. Monitor connection pool metrics
3. Enable SSL for database connections
4. Regular backups with automated schedules

### Security
1. Never commit `DATABASE_URL` to version control
2. Use environment variables for credentials
3. Limit database user permissions
4. Enable row-level security for multi-tenant data

---

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [BetterAuth Documentation](https://www.better-auth.com)

## Local Testing

### Running Tests with Database

Weft provides a test database setup that matches the CI environment, allowing you to run backend tests locally before pushing changes.

#### Quick Start

Run all tests (backend + frontend) with automatic database setup:

```bash
# Run all tests locally
pnpm test:local

# Run with coverage
pnpm test:local:ci

# Run only backend tests
pnpm test:local:backend

# Run only frontend tests
pnpm test:local:frontend
```

#### Backend-Only Testing

For backend development, use the server-specific test script:

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

#### Manual Database Management

Start the test database manually:

```bash
# Start test database
docker compose -f docker/docker-compose.test.yml up -d

# Stop test database
docker compose -f docker/docker-compose.test.yml down

# View database logs
docker logs weft-test-postgres
```

#### Test Database Configuration

The test database uses the following credentials (matching CI):

| Setting | Value |
|---------|-------|
| Database | `weft_test` |
| User | `weft_test` |
| Password | `weft_test_password` |
| Port | `5432` |

Connection string:
```
postgresql://weft_test:weft_test_password@localhost:5432/weft_test
```

#### Troubleshooting

**Port already in use:**
```bash
# Check what's using port 5432
lsof -i :5432

# Stop existing PostgreSQL service
brew services stop postgresql  # macOS
sudo systemctl stop postgresql # Linux
```

**Database connection errors:**
```bash
# Verify database is running
docker ps | grep weft-test-postgres

# Check database health
docker exec weft-test-postgres pg_isready -U weft_test -d weft_test
```

**Reset test database:**
```bash
# Stop and remove volumes
docker compose -f docker/docker-compose.test.yml down -v

# Start fresh
docker compose -f docker/docker-compose.test.yml up -d
```
