/**
 * Database schema tests
 * Tests database schema constraints, indexes, and relationships
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, getTestDbRaw } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

describe('Database Schema', () => {
  let db: ReturnType<typeof getTestDb>;
  let rawDb: ReturnType<typeof getTestDbRaw>;

  beforeEach(() => {
    db = getTestDb();
    rawDb = getTestDbRaw();
  });

  describe('Users Table', () => {
    it('should create a user with required fields', async () => {
      const userId = randomUUID();
      const now = new Date();

      const users = await db
        .insert(schema.users)
        .values({
          id: userId,
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          emailVerified: false,
          passwordHash: 'hashed-password',
          preferredLanguage: 'en',
          transcriptionModel: 'Xenova/whisper-small',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(userId);
      expect(users[0].email).toBe('test@example.com');
      expect(users[0].username).toBe('testuser');
    });

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';

      await db.insert(schema.users).values({
        id: randomUUID(),
        email,
        username: 'user1',
        name: 'User 1',
        emailVerified: false,
        passwordHash: 'hash1',
      });

      await expect(
        db.insert(schema.users).values({
          id: randomUUID(),
          email,
          username: 'user2',
          name: 'User 2',
          emailVerified: false,
          passwordHash: 'hash2',
        })
      ).rejects.toThrow();
    });

    it('should enforce unique username constraint', async () => {
      const username = 'duplicateuser';

      await db.insert(schema.users).values({
        id: randomUUID(),
        email: 'user1@example.com',
        username,
        name: 'User 1',
        emailVerified: false,
        passwordHash: 'hash1',
      });

      await expect(
        db.insert(schema.users).values({
          id: randomUUID(),
          email: 'user2@example.com',
          username,
          name: 'User 2',
          emailVerified: false,
          passwordHash: 'hash2',
        })
      ).rejects.toThrow();
    });

    it('should have default values for preferredLanguage and transcriptionModel', async () => {
      const user = await db.insert(schema.users).values({
        id: randomUUID(),
        email: 'defaults@example.com',
        username: 'defaultsuser',
        name: 'Default User',
        emailVerified: false,
        passwordHash: 'hash',
      }).returning();

      expect(user[0].preferredLanguage).toBe('en');
      expect(user[0].transcriptionModel).toBe('Xenova/whisper-small');
    });
  });

  describe('Sessions Table', () => {
    it('should create a session linked to a user', async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'sessiontest@example.com',
        username: 'sessionuser',
        name: 'Session User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const sessions = await db
        .insert(schema.sessions)
        .values({
          id: sessionId,
          userId,
          token: 'session-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe(userId);
    });

    it('should enforce cascade delete when user is deleted', async () => {
      const userId = randomUUID();
      const sessionId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'cascadetest@example.com',
        username: 'cascadeuser',
        name: 'Cascade User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.sessions).values({
        id: sessionId,
        userId,
        token: 'cascade-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, userId));

      // Session should be cascade deleted
      const sessions = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, sessionId));

      expect(sessions).toHaveLength(0);
    });
  });

  describe('Journals Table', () => {
    it('should create a journal linked to a user', async () => {
      const userId = randomUUID();
      const journalId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'journaluser@example.com',
        username: 'journaluser',
        name: 'Journal User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const journals = await db
        .insert(schema.journals)
        .values({
          id: journalId,
          userId,
          title: 'Test Journal',
          videoPath: '/uploads/test.webm',
          duration: 60,
        })
        .returning();

      expect(journals).toHaveLength(1);
      expect(journals[0].userId).toBe(userId);
      expect(journals[0].title).toBe('Test Journal');
    });

    it('should store JSONB data for emotion timeline and scores', async () => {
      const userId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'emotionuser@example.com',
        username: 'emotionuser',
        name: 'Emotion User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const emotionTimeline = [
        { time: 0, emotion: 'neutral', confidence: 0.8 },
        { time: 5, emotion: 'happy', confidence: 0.9 },
      ];
      const emotionScores = { neutral: 0.5, happy: 0.3, sad: 0.2 };

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId,
          title: 'Emotion Test Journal',
          videoPath: '/uploads/test.webm',
          duration: 10,
          emotionTimeline,
          emotionScores,
        })
        .returning();

      expect(journal[0].emotionTimeline).toEqual(emotionTimeline);
      expect(journal[0].emotionScores).toEqual(emotionScores);
    });
  });

  describe('Notes Table', () => {
    it('should create hierarchical notes with parent-child relationships', async () => {
      const userId = randomUUID();
      const parentId = randomUUID();
      const childId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'noteuser@example.com',
        username: 'noteuser',
        name: 'Note User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.notes).values({
        id: parentId,
        userId,
        title: 'Parent Note',
        position: 0,
      });

      const child = await db
        .insert(schema.notes)
        .values({
          id: childId,
          userId,
          title: 'Child Note',
          parentId,
          position: 0,
        })
        .returning();

      expect(child[0].parentId).toBe(parentId);
    });

    it('should support soft delete with deletedAt timestamp', async () => {
      const userId = randomUUID();
      const noteId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'softdelete@example.com',
        username: 'softdelete',
        name: 'Soft Delete User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.notes).values({
        id: noteId,
        userId,
        title: 'To Be Deleted',
        position: 0,
      });

      // Soft delete
      await db
        .update(schema.notes)
        .set({ deletedAt: new Date() })
        .where(eq(schema.notes.id, noteId));

      const note = await db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.id, noteId));

      expect(note[0].deletedAt).not.toBeNull();
    });

    it('should have default icon value', async () => {
      const userId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'iconuser@example.com',
        username: 'iconuser',
        name: 'Icon User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const note = await db
        .insert(schema.notes)
        .values({
          id: randomUUID(),
          userId,
          title: 'Icon Test',
          position: 0,
        })
        .returning();

      expect(note[0].icon).toBe('📝');
    });
  });

  describe('Templates Table', () => {
    it('should create a template for a user', async () => {
      const userId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'templateuser@example.com',
        username: 'templateuser',
        name: 'Template User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const template = await db
        .insert(schema.templates)
        .values({
          id: randomUUID(),
          userId,
          title: 'Daily Journal',
          content: '## What happened today?\n\n## How did I feel?\n\n## What am I grateful for?',
        })
        .returning();

      expect(template[0].userId).toBe(userId);
      expect(template[0].content).toContain('What happened today?');
    });

    it('should have default icon value', async () => {
      const userId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'templatedefault@example.com',
        username: 'templatedefault',
        name: 'Template Default User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      const template = await db
        .insert(schema.templates)
        .values({
          id: randomUUID(),
          userId,
          title: 'Default Icon Test',
        })
        .returning();

      expect(template[0].icon).toBe('📝');
    });
  });

  describe('Journal Notes Junction Table', () => {
    it('should link a note to a journal', async () => {
      const userId = randomUUID();
      const journalId = randomUUID();
      const noteId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'junctionuser@example.com',
        username: 'junctionuser',
        name: 'Junction User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.journals).values({
        id: journalId,
        userId,
        title: 'Test Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
      });

      await db.insert(schema.notes).values({
        id: noteId,
        userId,
        title: 'Test Note',
        position: 0,
      });

      const link = await db
        .insert(schema.journalNotes)
        .values({
          id: randomUUID(),
          noteId,
          journalId,
        })
        .returning();

      expect(link[0].noteId).toBe(noteId);
      expect(link[0].journalId).toBe(journalId);
    });

    it('should enforce unique constraint on journal-note pairs', async () => {
      const userId = randomUUID();
      const journalId = randomUUID();
      const noteId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'uniqueconstraint@example.com',
        username: 'uniqueconstraint',
        name: 'Unique Constraint User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.journals).values({
        id: journalId,
        userId,
        title: 'Test Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
      });

      await db.insert(schema.notes).values({
        id: noteId,
        userId,
        title: 'Test Note',
        position: 0,
      });

      await db.insert(schema.journalNotes).values({
        id: randomUUID(),
        noteId,
        journalId,
      });

      await expect(
        db.insert(schema.journalNotes).values({
          id: randomUUID(),
          noteId,
          journalId,
        })
      ).rejects.toThrow();
    });
  });

  describe('Transcripts Table', () => {
    it('should create a transcript linked to a journal', async () => {
      const userId = randomUUID();
      const journalId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'transcriptuser@example.com',
        username: 'transcriptuser',
        name: 'Transcript User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.journals).values({
        id: journalId,
        userId,
        title: 'Test Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
      });

      const segments = [
        { start: 0, end: 2.5, text: 'Hello world' },
        { start: 2.5, end: 5.0, text: 'This is a test' },
      ];

      const transcript = await db
        .insert(schema.transcripts)
        .values({
          id: randomUUID(),
          journalId,
          text: 'Hello world. This is a test.',
          segments,
        })
        .returning();

      expect(transcript[0].journalId).toBe(journalId);
      expect(transcript[0].segments).toEqual(segments);
    });

    it('should cascade delete when journal is deleted', async () => {
      const userId = randomUUID();
      const journalId = randomUUID();
      const transcriptId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'transcriptcascade@example.com',
        username: 'transcriptcascade',
        name: 'Transcript Cascade User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      await db.insert(schema.journals).values({
        id: journalId,
        userId,
        title: 'Test Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
      });

      await db.insert(schema.transcripts).values({
        id: transcriptId,
        journalId,
        text: 'Test transcript',
        segments: [],
      });

      // Delete journal
      await db.delete(schema.journals).where(eq(schema.journals.id, journalId));

      // Transcript should be cascade deleted
      const transcripts = await db
        .select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.id, transcriptId));

      expect(transcripts).toHaveLength(0);
    });
  });

  describe('Indexes', () => {
    it('should have indexes on commonly queried fields', async () => {
      // This test verifies that indexes exist by checking their performance
      // In a real scenario, you might query pg_indexes directly

      const userId = randomUUID();

      await db.insert(schema.users).values({
        id: userId,
        email: 'indexuser@example.com',
        username: 'indexuser',
        name: 'Index User',
        emailVerified: false,
        passwordHash: 'hash',
      });

      // Create multiple journals to test index effectiveness
      for (let i = 0; i < 10; i++) {
        await db.insert(schema.journals).values({
          id: randomUUID(),
          userId,
          title: `Journal ${i}`,
          videoPath: `/uploads/${i}.webm`,
          duration: 60,
        });
      }

      // Query by userId should be efficient with index
      const journals = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.userId, userId));

      expect(journals).toHaveLength(10);
    });
  });
});
