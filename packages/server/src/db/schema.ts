import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Users table
 * Stores user account information
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: index('users_username_idx').on(table.username),
    emailIdx: index('users_email_idx').on(table.email),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  })
);

/**
 * Journals table
 * Stores video journal entries
 */
export const journals = pgTable(
  'journals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    videoPath: text('video_path').notNull(),
    duration: integer('duration').notNull(), // Duration in seconds
    location: text('location'), // Optional location metadata
    notes: text('notes'), // Optional user notes
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('journals_user_id_idx').on(table.userId),
    createdAtIdx: index('journals_created_at_idx').on(table.createdAt),
    titleTextSearchIdx: index('journals_title_text_search_idx').using(
      'gin',
      table.title
    ),
  })
);

/**
 * Transcripts table
 * Stores transcript data for journal entries
 */
export const transcripts = pgTable(
  'transcripts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    segments: jsonb('segments').$type<{
      start: number;
      end: number;
      text: string;
      confidence?: number;
    }[]>(), // Array of timestamped transcript segments
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    journalIdIdx: index('transcripts_journal_id_idx').on(table.journalId),
    textSearchIdx: index('transcripts_text_search_idx').using('gin', table.text),
  })
);

/**
 * Tags table
 * Stores tags for organizing journals
 */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    journalIdIdx: index('tags_journal_id_idx').on(table.journalId),
    tagIdx: index('tags_tag_idx').on(table.tag),
    // Composite index for journal + tag lookups
    journalTagIdx: index('tags_journal_tag_idx').on(table.journalId, table.tag),
  })
);

/**
 * Type exports
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Journal = typeof journals.$inferSelect;
export type NewJournal = typeof journals.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
