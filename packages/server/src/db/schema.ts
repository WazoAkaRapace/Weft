import { pgTable, text, timestamp, uuid, integer, jsonb, index, boolean } from 'drizzle-orm/pg-core';

/**
 * Users table
 * Stores user account information
 * Extended with Better Auth fields
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').unique(),
    email: text('email').unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    passwordHash: text('password_hash'),
    image: text('image'),
    name: text('name'),
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
 * Sessions table
 * Stores user sessions for Better Auth
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    tokenIdx: index('sessions_token_idx').on(table.token),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Accounts table
 * Stores OAuth provider accounts for Better Auth
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    expiresAt: timestamp('expires_at'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('accounts_user_id_idx').on(table.userId),
    providerIdx: index('accounts_provider_idx').on(table.providerId, table.accountId),
  })
);

/**
 * Verifications table
 * Stores email verification tokens and password reset tokens
 */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index('verifications_identifier_idx').on(table.identifier),
    expiresAtIdx: index('verifications_expires_at_idx').on(table.expiresAt),
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
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type Journal = typeof journals.$inferSelect;
export type NewJournal = typeof journals.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
