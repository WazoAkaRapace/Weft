import { pgTable, text, timestamp, uuid, integer, jsonb, index, boolean, unique } from 'drizzle-orm/pg-core';

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
    preferredLanguage: text('preferred_language').default('en'), // User's preferred transcription language
    transcriptionModel: text('transcription_model').default('Xenova/whisper-small'), // User's preferred Whisper model for transcription
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
    thumbnailPath: text('thumbnail_path'), // Optional thumbnail image path
    duration: integer('duration').notNull(), // Duration in seconds
    location: text('location'), // Optional location metadata
    notes: text('notes'), // Optional user notes
    dominantEmotion: text('dominant_emotion'), // Dominant emotion: happy, sad, angry, fear, surprise, disgust, neutral
    emotionTimeline: jsonb('emotion_timeline').$type<Array<{
      time: number;      // Timestamp in seconds
      emotion: string;   // Emotion label
      confidence: number; // 0-1 confidence score
    }>>(), // Frame-by-frame emotion timeline
    emotionScores: jsonb('emotion_scores').$type<Record<string, number>>(), // Emotion distribution: { happy: 0.45, ... }
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('journals_user_id_idx').on(table.userId),
    createdAtIdx: index('journals_created_at_idx').on(table.createdAt),
    titleIdx: index('journals_title_idx').on(table.title),
    dominantEmotionIdx: index('journals_dominant_emotion_idx').on(table.dominantEmotion),
  })
);

/**
 * Notes table
 * Stores hierarchical notes with optional journal linking
 */
// @ts-ignore - Self-referencing type issue with Drizzle ORM
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content'), // Markdown content, optional
    icon: text('icon').default('📝'), // Emoji or icon for visual identification
    color: text('color'), // Hex color code (e.g., "#3b82f6") for organization
    // @ts-ignore - Self-referencing for tree structure
    parentId: uuid('parent_id').references(() => notes.id, { onDelete: 'set null' }), // Self-referencing for tree structure
    position: integer('position').notNull().default(0), // For ordering within parent
    deletedAt: timestamp('deleted_at'), // Soft delete timestamp (NULL if not deleted)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notes_user_id_idx').on(table.userId),
    parentIdIdx: index('notes_parent_id_idx').on(table.parentId),
    userDeletedIdx: index('notes_user_deleted_idx').on(table.userId, table.deletedAt),
    parentPositionIdx: index('notes_parent_position_idx').on(table.parentId, table.position),
    deletedAtIdx: index('notes_deleted_at_idx').on(table.deletedAt),
  })
);

/**
 * Journal Notes table
 * Junction table for many-to-many relationship between notes and journals
 */
export const journalNotes = pgTable(
  'journal_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    noteIdIdx: index('journal_notes_note_id_idx').on(table.noteId),
    journalIdIdx: index('journal_notes_journal_id_idx').on(table.journalId),
    uniqueConstraint: unique('journal_note_unique').on(table.journalId, table.noteId),
  })
);

/**
 * Templates table
 * Stores user-specific note templates with predefined content
 */
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content'), // Markdown content template
    icon: text('icon').default('📝'), // Emoji or icon for visual identification
    color: text('color'), // Hex color code for organization
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('templates_user_id_idx').on(table.userId),
    createdAtIdx: index('templates_created_at_idx').on(table.createdAt),
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
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type JournalNote = typeof journalNotes.$inferSelect;
export type NewJournalNote = typeof journalNotes.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
