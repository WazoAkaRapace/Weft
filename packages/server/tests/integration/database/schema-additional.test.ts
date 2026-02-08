/**
 * Additional Database Schema tests
 * Tests for Accounts, Tags, and previously untested fields
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb, getTestDbRaw } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser } from '../../fixtures/auth.js';

describe('Additional Database Schema Tests', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  describe('Accounts Table (OAuth)', () => {
    it('should create an OAuth account linked to a user', async () => {
      const user = await createTestUser({
        email: 'oauth@example.com',
        username: 'oauthuser',
        name: 'OAuth User',
      });

      const account = await db
        .insert(schema.accounts)
        .values({
          id: randomUUID(),
          userId: user.id,
          accountId: 'google-user-123',
          providerId: 'google',
          accessToken: 'google-access-token',
          refreshToken: 'google-refresh-token',
          idToken: 'google-id-token',
        })
        .returning();

      expect(account).toHaveLength(1);
      expect(account[0].userId).toBe(user.id);
      expect(account[0].providerId).toBe('google');
      expect(account[0].accountId).toBe('google-user-123');
    });

    it('should allow multiple OAuth accounts per user', async () => {
      const user = await createTestUser({
        email: 'multioauth@example.com',
        username: 'multioauthuser',
        name: 'Multi OAuth User',
      });

      // Google account
      await db.insert(schema.accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: 'google-user-123',
        providerId: 'google',
        accessToken: 'google-token',
      });

      // GitHub account
      await db.insert(schema.accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: 'github-user-456',
        providerId: 'github',
        accessToken: 'github-token',
      });

      const accounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, user.id));

      expect(accounts).toHaveLength(2);
      expect(accounts.some((a) => a.providerId === 'google')).toBe(true);
      expect(accounts.some((a) => a.providerId === 'github')).toBe(true);
    });

    it('should enforce unique provider+accountId combination', async () => {
      const user = await createTestUser({
        email: 'uniqueoauth@example.com',
        username: 'uniqueoauthuser',
        name: 'Unique OAuth User',
      });

      // Add Google account
      await db.insert(schema.accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: 'google-user-789',
        providerId: 'google',
        accessToken: 'google-token',
      });

      // Try to add duplicate
      await expect(
        db.insert(schema.accounts).values({
          id: randomUUID(),
          userId: user.id,
          accountId: 'google-user-789', // Same accountId
          providerId: 'google', // Same provider
          accessToken: 'different-token',
        })
      ).rejects.toThrow();
    });

    it('should support token refresh with expiration time', async () => {
      const user = await createTestUser({
        email: 'tokenrefresh@example.com',
        username: 'tokenrefreshuser',
        name: 'Token Refresh User',
      });

      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      const account = await db
        .insert(schema.accounts)
        .values({
          id: randomUUID(),
          userId: user.id,
          accountId: 'refreshable-account',
          providerId: 'oauth-provider',
          accessToken: 'current-access-token',
          refreshToken: 'refresh-token',
          expiresAt,
        })
        .returning();

      expect(account[0].expiresAt).toBeDefined();
      expect(account[0]!.expiresAt!.getTime()).toBeCloseTo(expiresAt.getTime(), 1000);
    });

    it('should cascade delete accounts when user is deleted', async () => {
      const user = await createTestUser({
        email: 'cascadeaccount@example.com',
        username: 'cascadeaccountuser',
        name: 'Cascade Account User',
      });

      const accountId = randomUUID();
      await db.insert(schema.accounts).values({
        id: accountId,
        userId: user.id,
        accountId: 'account-to-delete',
        providerId: 'provider',
        accessToken: 'token',
      });

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      // Account should be cascade deleted
      const accounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, accountId));

      expect(accounts).toHaveLength(0);
    });
  });

  describe('Tags Table', () => {
    it('should create a tag linked to a journal', async () => {
      const user = await createTestUser({
        email: 'taguser@example.com',
        username: 'taguser',
        name: 'Tag User',
      });

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Tagged Journal',
          videoPath: '/uploads/tagged.webm',
          duration: 60,
        })
        .returning();

      const tag = await db
        .insert(schema.tags)
        .values({
          id: randomUUID(),
          journalId: journal[0].id,
          tag: 'important',
        })
        .returning();

      expect(tag).toHaveLength(1);
      expect(tag[0].journalId).toBe(journal[0].id);
      expect(tag[0].tag).toBe('important');
    });

    it('should allow multiple tags per journal', async () => {
      const user = await createTestUser({
        email: 'multitag@example.com',
        username: 'multitaguser',
        name: 'Multi Tag User',
      });

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Multi Tag Journal',
          videoPath: '/uploads/multi.webm',
          duration: 60,
        })
        .returning();

      // Add multiple tags
      await db.insert(schema.tags).values({
        id: randomUUID(),
        journalId: journal[0].id,
        tag: 'important',
      });

      await db.insert(schema.tags).values({
        id: randomUUID(),
        journalId: journal[0].id,
        tag: 'work',
      });

      await db.insert(schema.tags).values({
        id: randomUUID(),
        journalId: journal[0].id,
        tag: 'idea',
      });

      const tags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.journalId, journal[0].id));

      expect(tags).toHaveLength(3);
    });

    it('should allow same tag on different journals', async () => {
      const user = await createTestUser({
        email: 'sametag@example.com',
        username: 'sametaguser',
        name: 'Same Tag User',
      });

      const journal1 = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Journal 1',
          videoPath: '/uploads/j1.webm',
          duration: 60,
        })
        .returning();

      const journal2 = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Journal 2',
          videoPath: '/uploads/j2.webm',
          duration: 60,
        })
        .returning();

      // Tag both journals with same tag
      await db.insert(schema.tags).values({
        id: randomUUID(),
        journalId: journal1[0].id,
        tag: 'favorite',
      });

      await db.insert(schema.tags).values({
        id: randomUUID(),
        journalId: journal2[0].id,
        tag: 'favorite',
      });

      // Both should exist
      const tags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.tag, 'favorite'));

      expect(tags).toHaveLength(2);
    });

    it('should cascade delete tags when journal is deleted', async () => {
      const user = await createTestUser({
        email: 'cascadetag@example.com',
        username: 'cascadetaguser',
        name: 'Cascade Tag User',
      });

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Tagged Journal',
          videoPath: '/uploads/tagged.webm',
          duration: 60,
        })
        .returning();

      const tagId = randomUUID();
      await db.insert(schema.tags).values({
        id: tagId,
        journalId: journal[0].id,
        tag: 'test-tag',
      });

      // Delete journal
      await db.delete(schema.journals).where(eq(schema.journals.id, journal[0].id));

      // Tag should be cascade deleted
      const tags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.id, tagId));

      expect(tags).toHaveLength(0);
    });
  });

  describe('Journal HLS Fields', () => {
    it('should store HLS transcoding status', async () => {
      const user = await createTestUser({
        email: 'hls@example.com',
        username: 'hlsuser',
        name: 'HLS User',
      });

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'HLS Test Journal',
          videoPath: '/uploads/hls-test.webm',
          duration: 60,
          hlsStatus: 'pending',
        })
        .returning();

      expect(journal[0].hlsStatus).toBe('pending');
    });

    it('should store HLS manifest path when transcoding completes', async () => {
      const user = await createTestUser({
        email: 'hlsmanifest@example.com',
        username: 'hlsmanifestuser',
        name: 'HLS Manifest User',
      });

      const manifestPath = '/uploads/hls/journal-id/master.m3u8';

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'HLS Manifest Test Journal',
          videoPath: '/uploads/hls-manifest.webm',
          duration: 60,
          hlsStatus: 'completed',
          hlsManifestPath: manifestPath,
        })
        .returning();

      expect(journal[0].hlsManifestPath).toBe(manifestPath);
      expect(journal[0].hlsStatus).toBe('completed');
    });

    it('should store HLS error when transcoding fails', async () => {
      const user = await createTestUser({
        email: 'hlserror@example.com',
        username: 'hlserroruser',
        name: 'HLS Error User',
      });

      const errorMessage = 'FFmpeg not found';

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'HLS Error Test Journal',
          videoPath: '/uploads/hls-error.webm',
          duration: 60,
          hlsStatus: 'failed',
          hlsError: errorMessage,
        })
        .returning();

      expect(journal[0].hlsStatus).toBe('failed');
      expect(journal[0].hlsError).toBe(errorMessage);
    });

    it('should store HLS completion timestamp', async () => {
      const user = await createTestUser({
        email: 'hlstimestamp@example.com',
        username: 'hlstimestampuser',
        name: 'HLS Timestamp User',
      });

      const completedAt = new Date();

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'HLS Timestamp Test Journal',
          videoPath: '/uploads/hls-timestamp.webm',
          duration: 60,
          hlsStatus: 'completed',
          hlsCreatedAt: completedAt,
        })
        .returning();

      expect(journal[0].hlsCreatedAt).toBeDefined();
      expect(journal[0]!.hlsCreatedAt!.getTime()).toBeCloseTo(completedAt.getTime(), 100);
    });
  });

  describe('Color Fields (Notes & Templates)', () => {
    it('should store hex color on notes', async () => {
      const user = await createTestUser({
        email: 'colornote@example.com',
        username: 'colornoteuser',
        name: 'Color Note User',
      });

      const color = '#3b82f6';

      const note = await db
        .insert(schema.notes)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Colored Note',
          position: 0,
          color,
        })
        .returning();

      expect(note[0].color).toBe(color);
    });

    it('should accept null color on notes', async () => {
      const user = await createTestUser({
        email: 'nullcolornote@example.com',
        username: 'nullcolornoteuser',
        name: 'Null Color Note User',
      });

      const note = await db
        .insert(schema.notes)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Null Color Note',
          position: 0,
          color: null,
        })
        .returning();

      expect(note[0].color).toBeNull();
    });

    it('should store hex color on templates', async () => {
      const user = await createTestUser({
        email: 'colortemplate@example.com',
        username: 'colortemplateuser',
        name: 'Color Template User',
      });

      const color = '#10b981';

      const template = await db
        .insert(schema.templates)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Colored Template',
          color,
        })
        .returning();

      expect(template[0].color).toBe(color);
    });

    it('should handle empty string vs null for color', async () => {
      const user = await createTestUser({
        email: 'emptycolor@example.com',
        username: 'emptycoloruser',
        name: 'Empty Color User',
      });

      const noteWithEmpty = await db
        .insert(schema.notes)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Empty Color Note',
          position: 0,
          color: '',
        })
        .returning();

      const noteWithNull = await db
        .insert(schema.notes)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Null Color Note',
          position: 0,
          color: null,
        })
        .returning();

      expect(noteWithEmpty[0].color).toBe('');
      expect(noteWithNull[0].color).toBeNull();
    });
  });

  describe('manualMood Field', () => {
    it('should store user-set manual mood', async () => {
      const user = await createTestUser({
        email: 'manualmood@example.com',
        username: 'manualmooduser',
        name: 'Manual Mood User',
      });

      const manualMood = 'happy';

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Manual Mood Journal',
          videoPath: '/uploads/manual-mood.webm',
          duration: 60,
          manualMood,
        })
        .returning();

      expect(journal[0].manualMood).toBe(manualMood);
    });

    it('should allow clearing manual mood with null', async () => {
      const user = await createTestUser({
        email: 'clearmanualmood@example.com',
        username: 'clearmanualmooduser',
        name: 'Clear Manual Mood User',
      });

      // Create journal with manual mood
      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Clear Manual Mood Journal',
          videoPath: '/uploads/clear-manual-mood.webm',
          duration: 60,
          manualMood: 'sad',
        })
        .returning();

      // Clear it
      await db
        .update(schema.journals)
        .set({ manualMood: null })
        .where(eq(schema.journals.id, journal[0].id));

      const updated = await db
        .select()
        .from(schema.journals)
        .where(eq(schema.journals.id, journal[0].id));

      expect(updated[0].manualMood).toBeNull();
    });

    it('should coexist manualMood with detected emotions', async () => {
      const user = await createTestUser({
        email: 'bothmoods@example.com',
        username: 'bothmoodsuser',
        name: 'Both Moods User',
      });

      const journal = await db
        .insert(schema.journals)
        .values({
          id: randomUUID(),
          userId: user.id,
          title: 'Both Moods Journal',
          videoPath: '/uploads/both-moods.webm',
          duration: 60,
          manualMood: 'happy',
          dominantEmotion: 'sad', // Detected emotion
          emotionTimeline: [{ time: 0, emotion: 'sad', confidence: 0.8 }],
          emotionScores: { sad: 0.8, neutral: 0.2 },
        })
        .returning();

      expect(journal[0].manualMood).toBe('happy');
      expect(journal[0].dominantEmotion).toBe('sad');
    });

    it('should accept valid emotion values for manualMood', async () => {
      const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];

      const user = await createTestUser({
        email: 'validmoods@example.com',
        username: 'validmoodsuser',
        name: 'Valid Moods User',
      });

      for (const emotion of validEmotions) {
        const journal = await db
          .insert(schema.journals)
          .values({
            id: randomUUID(),
            userId: user.id,
            title: `Mood Test ${emotion}`,
            videoPath: `/uploads/${emotion}.webm`,
            duration: 60,
            manualMood: emotion,
          })
          .returning();

        expect(journal[0].manualMood).toBe(emotion);
      }
    });
  });

  describe('Index Verification with EXPLAIN ANALYZE', () => {
    it('should use index when querying by userId on journals table', async () => {
      const rawDb = getTestDbRaw();

      const explainResult = await rawDb.unsafe(`
        EXPLAIN ANALYZE
        SELECT * FROM journals WHERE user_id = $1
      `);

      // Check if index scan is used
      const planText = JSON.stringify(explainResult);
      expect(planText.toLowerCase()).toContain('index');
    });

    it('should use index when querying by journalId on transcripts table', async () => {
      const rawDb = getTestDbRaw();

      const explainResult = await rawDb.unsafe(`
        EXPLAIN ANALYZE
        SELECT * FROM transcripts WHERE journal_id = $1
      `);

      const planText = JSON.stringify(explainResult);
      expect(planText.toLowerCase()).toContain('index');
    });

    it('should use index when querying by userId on notes table', async () => {
      const rawDb = getTestDbRaw();

      const explainResult = await rawDb.unsafe(`
        EXPLAIN ANALYZE
        SELECT * FROM notes WHERE user_id = $1 AND deleted_at IS NULL
      `);

      const planText = JSON.stringify(explainResult);
      expect(planText.toLowerCase()).toContain('index');
    });
  });
});
