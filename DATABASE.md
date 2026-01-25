# Weft Database Documentation

This document describes the database schema, architecture, and management for the Weft application using Drizzle ORM and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Schema Reference](#schema-reference)
- [Indices and Performance](#indices-and-performance)
- [Connection Pool Configuration](#connection-pool-configuration)
- [Migrations](#migrations)
- [Seed Data](#seed-data)
- [Environment Variables](#environment-variables)
- [Database Operations](#database-operations)

## Overview

Weft uses **PostgreSQL** as the primary database, managed through **Drizzle ORM**. The database is designed to support a video journaling application with features including:

- User authentication and management
- Video journal entries with metadata
- Automatic transcription with timestamped segments
- Tag-based organization and search

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            WEFT DATABASE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │    USERS     │                                                   │
│  ├──────────────┤                                                   │
│  │ id (PK)      │                                                   │
│  │ username     │                                                   │
│  │ email        │                                                   │
│  │ passwordHash │                                                   │
│  │ createdAt    │                                                   │
│  │ updatedAt    │                                                   │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         │ 1:N                                                       │
│         │                                                            │
│         ▼                                                            │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                      JOURNALS                              │      │
│  ├───────────────────────────────────────────────────────────┤      │
│  │ id (PK)              UUID                                   │      │
│  │ userId (FK)          UUID ──────────┐                       │      │
│  │ title                TEXT           │                       │      │
│  │ videoPath            TEXT           │                       │      │
│  │ duration             INTEGER        │                       │      │
│  │ location             TEXT           │                       │      │
│  │ notes                TEXT           │                       │      │
│  │ createdAt            TIMESTAMP      │                       │      │
│  │ updatedAt            TIMESTAMP      │                       │      │
│  └────────┬──────────────────────────────┴───────────┬────────┘      │
│           │                                          │                      │
│           │ 1:N                                      │ 1:N                  │
│           │                                          │                      │
│           ▼                                          ▼                      │
│  ┌─────────────────────────┐              ┌─────────────────┐              │
│  │     TRANSCRIPTS         │              │      TAGS       │              │
│  ├─────────────────────────┤              ├─────────────────┤              │
│  │ id (PK)        UUID     │              │ id (PK)  UUID    │              │
│  │ journalId (FK) UUID     │              │ journalId UUID   │              │
│  │ text           TEXT     │              │ tag       TEXT   │              │
│  │ segments       JSONB    │              │ createdAt TIMESTAMP│           │
│  │ createdAt      TIMESTAMP│              └─────────────────┘              │
│  └─────────────────────────┘                                                │
│                                                                     │
│  Legend:                                                            │
│  ─────  FK (Foreign Key)                                            │
│  PK    Primary Key                                                  │
│  1:N   One-to-Many relationship                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Schema Reference

### Users Table

Stores user account information and authentication credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique user identifier |
| `username` | TEXT | NOT NULL, UNIQUE | User's chosen username |
| `email` | TEXT | NOT NULL, UNIQUE | User's email address |
| `passwordHash` | TEXT | NOT NULL | Bcrypt hashed password |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indices:**
- `users_username_idx` on `username` - Fast username lookups
- `users_email_idx` on `email` - Fast email lookups
- `users_created_at_idx` on `created_at` - Sorting by creation date

**TypeScript Types:**
```typescript
type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};
```

---

### Journals Table

Stores video journal entries with metadata and location information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique journal identifier |
| `userId` | UUID | FK(users.id), NOT NULL | Owner of the journal |
| `title` | TEXT | NOT NULL | Journal entry title |
| `videoPath` | TEXT | NOT NULL | Filesystem path to video |
| `duration` | INTEGER | NOT NULL | Duration in seconds |
| `location` | TEXT | NULLABLE | Optional location metadata |
| `notes` | TEXT | NULLABLE | Optional user notes |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indices:**
- `journals_user_id_idx` on `user_id` - Fast user journal queries
- `journals_created_at_idx` on `created_at` - Chronological sorting
- `journals_title_text_search_idx` GIN on `title` - Full-text title search

**TypeScript Types:**
```typescript
type Journal = {
  id: string;
  userId: string;
  title: string;
  videoPath: string;
  duration: number;  // seconds
  location: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
```

---

### Transcripts Table

Stores automatic transcription data with timestamped segments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique transcript identifier |
| `journalId` | UUID | FK(journals.id), NOT NULL | Associated journal entry |
| `text` | TEXT | NOT NULL | Full transcript text |
| `segments` | JSONB | NULLABLE | Array of timestamped segments |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Segments JSONB Structure:**
```typescript
type TranscriptSegment = {
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  text: string;       // Segment text
  confidence?: number; // Optional confidence score (0-1)
};

type Transcript = {
  id: string;
  journalId: string;
  text: string;
  segments: TranscriptSegment[] | null;
  createdAt: Date;
};
```

**Indices:**
- `transcripts_journal_id_idx` on `journal_id` - Fast transcript lookups
- `transcripts_text_search_idx` GIN on `text` - Full-text transcript search

---

### Tags Table

Stores tags for organizing and categorizing journal entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique tag identifier |
| `journalId` | UUID | FK(journals.id), NOT NULL | Associated journal entry |
| `tag` | TEXT | NOT NULL | Tag text |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indices:**
- `tags_journal_id_idx` on `journal_id` - Fast tag lookups by journal
- `tags_tag_idx` on `tag` - Tag search and filtering
- `tags_journal_tag_idx` composite on `(journal_id, tag)` - Efficient tag queries

**TypeScript Types:**
```typescript
type Tag = {
  id: string;
  journalId: string;
  tag: string;
  createdAt: Date;
};
```

---

## Indices and Performance

### Index Strategy

The database uses a combination of B-tree and GIN indexes for optimal query performance:

| Index | Type | Purpose |
|-------|------|---------|
| `users_username_idx` | B-tree | Fast username authentication |
| `users_email_idx` | B-tree | Fast email lookups |
| `journals_user_id_idx` | B-tree | User's journal feed |
| `journals_created_at_idx` | B-tree | Chronological ordering |
| `journals_title_text_search_idx` | GIN | Full-text title search |
| `transcripts_journal_id_idx` | B-tree | Transcript retrieval |
| `transcripts_text_search_idx` | GIN | Full-text content search |
| `tags_journal_id_idx` | B-tree | Journal tag listing |
| `tags_tag_idx` | B-tree | Tag filtering |
| `tags_journal_tag_idx` | B-tree | Composite lookups |

### Full-Text Search

PostgreSQL's GIN indexes enable efficient full-text search:

```typescript
// Search journals by title
const results = await db
  .select()
  .from(journals)
  .where(ilike(journals.title, `%${searchTerm}%`));

// Search transcripts by content
const results = await db
  .select({
    journal: journals,
    transcript: transcripts,
  })
  .from(transcripts)
  .innerJoin(journals, eq(transcripts.journalId, journals.id))
  .where(ilike(transcripts.text, `%${searchTerm}%`));
```

---

## Connection Pool Configuration

The database uses a connection pool for optimal performance:

### Pool Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `max` | 10 | Maximum connections in pool |
| `idle_timeout` | 20s | Close idle connections |
| `connect_timeout` | 10s | Maximum connection wait time |

### Configuration

```typescript
// packages/server/src/db/index.ts
const poolConfig = {
  max: 10,              // Maximum pool size
  idle_timeout: 20,     // Idle timeout (seconds)
  connect_timeout: 10,  // Connection timeout (seconds)
};
```

### Health Check

```typescript
import { healthCheck } from './db';

const isHealthy = await healthCheck();
if (!isHealthy) {
  // Handle unhealthy database
}
```

---

## Migrations

### Generating Migrations

Create a new migration after schema changes:

```bash
pnpm --filter @weft/server db:generate
```

This creates a new migration file in `packages/server/drizzle/`.

### Applying Migrations

Apply pending migrations to the database:

```bash
pnpm --filter @weft/server db:migrate
```

### Pushing Schema (Development)

For development, push schema directly without migrations:

```bash
pnpm --filter @weft/server db:push
```

⚠️ **Warning:** Only use `db:push` in development. Use migrations in production.

### Migration Files

Migrations are stored in `packages/server/drizzle/` with the format:

```
drizzle/
├── 0001_initial.sql
├── 0002_add_index.sql
└── 0003_update_schema.sql
```

---

## Seed Data

### Running Seed Script

Populate the database with sample data:

```bash
pnpm --filter @weft/server db:seed
```

### Seed Data Includes

- 2 sample users
- 2 sample journals with video metadata
- 2 transcripts with timestamped segments
- 6 tags for organization

### Sample Credentials

After seeding, you can use these credentials:

| Username | Email |
|----------|-------|
| `johndoe` | `john@example.com` |
| `janedoe` | `jane@example.com` |

⚠️ **Note:** Passwords are placeholder hashes. Update for authentication implementation.

---

## Environment Variables

### Required Variables

```bash
# Database connection string
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Example Configurations

**Local Development:**
```bash
DATABASE_URL=postgresql://localhost:5432/weft
```

**Production (with connection pooling):**
```bash
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/weft?pool_max=10
```

**Docker Compose:**
```bash
DATABASE_URL=postgresql://weft:weft_password@db:5432/weft
```

---

## Database Operations

### Common Queries

#### Create a User

```typescript
import { db } from './db';
import { users } from './db/schema';

const newUser = await db
  .insert(users)
  .values({
    username: 'newuser',
    email: 'user@example.com',
    passwordHash: await bcrypt.hash('password123', 10),
  })
  .returning();
```

#### Get User's Journals

```typescript
import { db } from './db';
import { journals } from './db/schema';
import { eq } from 'drizzle-orm';

const userJournals = await db
  .select()
  .from(journals)
  .where(eq(journals.userId, userId))
  .orderBy(desc(journals.createdAt));
```

#### Search by Tag

```typescript
import { db } from './db';
import { journals, tags } from './db/schema';
import { eq } from 'drizzle-orm';

const taggedJournals = await db
  .select({
    journal: journals,
    tag: tags.tag,
  })
  .from(journals)
  .innerJoin(tags, eq(journals.id, tags.journalId))
  .where(eq(tags.tag, 'technology'));
```

#### Full-Text Search

```typescript
import { db } from './db';
import { journals, transcripts } from './db/schema';
import { or, ilike } from 'drizzle-orm';

const searchTerm = 'artificial intelligence';
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

### Database Management

#### Drizzle Studio

Open Drizzle Studio for visual database inspection:

```bash
pnpm --filter @weft/server db:studio
```

#### Backup Database

```bash
pg_dump $DATABASE_URL > backup.sql
```

#### Restore Database

```bash
psql $DATABASE_URL < backup.sql
```

---

## Best Practices

### Development

1. **Use migrations** for schema changes
2. **Run seed script** after database reset
3. **Use `db:push`** for rapid prototyping only
4. **Check connection pool** settings in production

### Production

1. **Always use migrations** - never `db:push`
2. **Monitor connection pool** metrics
3. **Enable SSL** for database connections
4. **Regular backups** with automated schedules
5. **Test migrations** on staging first

### Security

1. **Never commit** `DATABASE_URL` to version control
2. **Use environment variables** for credentials
3. **Rotate credentials** regularly
4. **Limit database user permissions** (least privilege)
5. **Enable row-level security** for multi-tenant data

---

## Troubleshooting

### Connection Issues

**Error:** `Connection refused`

**Solution:** Check that PostgreSQL is running and `DATABASE_URL` is correct.

```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql
```

### Migration Conflicts

**Error:** `Migration already applied`

**Solution:** Check migration status:

```bash
# View migration history
pnpm --filter @weft/server db:studio
```

### Pool Exhaustion

**Error:** `Connection pool exhausted`

**Solution:** Increase pool size or check for connection leaks:

```typescript
// In packages/server/src/db/index.ts
const poolConfig = {
  max: 20, // Increase from 10
  idle_timeout: 20,
  connect_timeout: 10,
};
```

---

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle Kit CLI](https://orm.drizzle.team/docs/kit-overview)
