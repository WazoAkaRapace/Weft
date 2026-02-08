/**
 * Transcription Service tests
 * Tests Whisper transcription service with mocked dependencies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession } from '../../fixtures/auth.js';
import { createTestJournal } from '../../fixtures/db.js';
import { TranscriptionService } from '../../../src/services/transcription.js';

// Mock nodejs-whisper
vi.mock('nodejs-whisper', () => ({
  nodewhisper: vi.fn(),
}));

// Mock FFmpeg spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(function(this: unknown, _event: string, callback: () => void) {
      if (_event === 'close') {
        // Simulate successful FFmpeg execution
        setTimeout(() => callback(0), 10);
      }
      return this;
    }),
    stderr: {
      on: vi.fn(function(this: unknown, _event: string, _callback: (data: unknown) => void) {
        return this;
      }),
    },
  })),
}));

import { nodewhisper } from 'nodejs-whisper';

describe('TranscriptionService', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let _testSession: Awaited<ReturnType<typeof createTestSession>>;
  let service: TranscriptionService;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'transcribe@example.com',
      username: 'transcribeuser',
      name: 'Transcribe User',
      preferredLanguage: 'en',
      transcriptionModel: 'Xenova/whisper-small',
    });

    _testSession = await createTestSession(testUser.id);

    service = new TranscriptionService();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('transcribe()', () => {
    const mockSRTOutput = `[00:00:00.000 --> 00:00:02.530]   Hello world
[00:00:02.530 --> 00:00:05.000]   This is a test
[00:00:05.000 --> 00:00:07.500]   of the transcription`;

    it('should transcribe a video file successfully', async () => {
      const journal = await createTestJournal(testUser.id);

      // Mock successful transcription
      vi.mocked(nodewhisper).mockResolvedValue(mockSRTOutput);

      const result = await service.transcribe({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      expect(result.text).toBe('Hello world This is a test of the transcription');
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0]).toEqual({
        start: 0,
        end: 2.53,
        text: 'Hello world',
      });
      expect(result.segments[1]).toEqual({
        start: 2.53,
        end: 5,
        text: 'This is a test',
      });
      expect(result.segments[2]).toEqual({
        start: 5,
        end: 7.5,
        text: 'of the transcription',
      });
    });

    it('should use user\'s preferred language setting', async () => {
      // Update user to Spanish
      await db
        .update(schema.users)
        .set({ preferredLanguage: 'es' })
        .where(eq(schema.users.id, testUser.id));

      const journal = await createTestJournal(testUser.id);

      vi.mocked(nodewhisper).mockResolvedValue(mockSRTOutput);

      await service.transcribe({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      expect(nodewhisper).toHaveBeenCalledWith(
        journal.videoPath,
        expect.objectContaining({
          modelName: 'small', // Converted from Xenova/whisper-small
        })
      );
    });

    it('should use user\'s transcription model preference', async () => {
      // Update user to use base model
      await db
        .update(schema.users)
        .set({ transcriptionModel: 'Xenova/whisper-base' })
        .where(eq(schema.users.id, testUser.id));

      const journal = await createTestJournal(testUser.id);

      vi.mocked(nodewhisper).mockResolvedValue(mockSRTOutput);

      await service.transcribe({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      expect(nodewhisper).toHaveBeenCalledWith(
        journal.videoPath,
        expect.objectContaining({
          modelName: 'base', // Converted from Xenova/whisper-base
        })
      );
    });

    it('should handle empty transcription output', async () => {
      const journal = await createTestJournal(testUser.id);

      vi.mocked(nodewhisper).mockResolvedValue('');

      const result = await service.transcribe({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      expect(result.text).toBe('');
      expect(result.segments).toHaveLength(0);
    });

    it('should throw error for non-existent journal', async () => {
      const fakeJournalId = randomUUID();

      await expect(
        service.transcribe({
          journalId: fakeJournalId,
          userId: testUser.id,
          videoPath: '/fake/path.webm',
        })
      ).rejects.toThrow(`Journal ${fakeJournalId} not found`);
    });

    it('should throw error when transcription fails', async () => {
      const journal = await createTestJournal(testUser.id);

      vi.mocked(nodewhisper).mockRejectedValue(new Error('Whisper failed'));

      await expect(
        service.transcribe({
          journalId: journal.id,
          userId: testUser.id,
          videoPath: journal.videoPath,
        })
      ).rejects.toThrow('Transcription failed');
    });

    it('should convert Xenova model names to nodejs-whisper format', async () => {
      const modelConversions = [
        ['Xenova/whisper-tiny', 'tiny'],
        ['Xenova/whisper-tiny.en', 'tiny.en'],
        ['Xenova/whisper-base', 'base'],
        ['Xenova/whisper-base.en', 'base.en'],
        ['Xenova/whisper-small', 'small'],
        ['Xenova/whisper-small.en', 'small.en'],
        ['Xenova/whisper-medium', 'medium'],
        ['Xenova/whisper-medium.en', 'medium.en'],
        ['Xenova/whisper-large', 'large'],
        ['Xenova/whisper-large-v2', 'large-v2'],
        ['Xenova/whisper-large-v3', 'large-v3-turbo'],
      ];

      for (const [xenovaModel, expectedModelName] of modelConversions) {
        await db
          .update(schema.users)
          .set({ transcriptionModel: xenovaModel as any })
          .where(eq(schema.users.id, testUser.id));

        const journal = await createTestJournal(testUser.id);
        vi.mocked(nodewhisper).mockResolvedValue(mockSRTOutput);

        await service.transcribe({
          journalId: journal.id,
          userId: testUser.id,
          videoPath: journal.videoPath,
        });

        expect(nodewhisper).toHaveBeenCalledWith(
          journal.videoPath,
          expect.objectContaining({
            modelName: expectedModelName,
          })
        );
      }
    });
  });

  describe('saveTranscription()', () => {
    it('should save transcription result to database', async () => {
      const journal = await createTestJournal(testUser.id);

      const result = {
        text: 'Test transcription text',
        segments: [
          { start: 0, end: 2.5, text: 'Test', confidence: 0.95 },
          { start: 2.5, end: 5.0, text: 'transcription text', confidence: 0.92 },
        ],
      };

      await service.saveTranscription(journal.id, result);

      const transcripts = await db
        .select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.journalId, journal.id));

      expect(transcripts).toHaveLength(1);
      expect(transcripts[0].journalId).toBe(journal.id);
      expect(transcripts[0].text).toBe('Test transcription text');
      expect(transcripts[0].segments).toEqual(result.segments);
    });

    it('should store segments as JSONB', async () => {
      const journal = await createTestJournal(testUser.id);

      const result = {
        text: 'Segment test',
        segments: [
          { start: 0, end: 1, text: 'First' },
          { start: 1, end: 2, text: 'Second' },
          { start: 2, end: 3, text: 'Third' },
        ],
      };

      await service.saveTranscription(journal.id, result);

      const transcripts = await db
        .select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.journalId, journal.id));

      expect(transcripts[0].segments).toEqual(result.segments);
    });
  });

  describe('getTranscription()', () => {
    it('should retrieve existing transcription', async () => {
      const journal = await createTestJournal(testUser.id);

      // Create a transcript
      await db.insert(schema.transcripts).values({
        id: randomUUID(),
        journalId: journal.id,
        text: 'Existing transcript',
        segments: [{ start: 0, end: 5, text: 'Existing transcript' }],
      });

      const result = await service.getTranscription(journal.id);

      expect(result).toBeDefined();
      expect(result!.text).toBe('Existing transcript');
    });

    it('should return null for non-existent transcript', async () => {
      const journal = await createTestJournal(testUser.id);

      const result = await service.getTranscription(journal.id);

      expect(result).toBeNull();
    });
  });

  describe('validateJournal()', () => {
    it('should return true for existing journal', async () => {
      const journal = await createTestJournal(testUser.id);

      const exists = await service.validateJournal(journal.id);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent journal', async () => {
      const fakeId = randomUUID();

      const exists = await service.validateJournal(fakeId);

      expect(exists).toBe(false);
    });
  });

  describe('extractAudio()', () => {
    it('should extract audio from video using FFmpeg', async () => {
      const { extractAudio } = await import('../../../src/services/transcription.js');
      const journal = await createTestJournal(testUser.id);

      const audioPath = await extractAudio(journal.videoPath);

      expect(audioPath).toBeDefined();
      expect(audioPath).toContain('.wav');
      expect(audioPath).toContain('/temp/');
    }, 10000);

    it('should use correct FFmpeg parameters for Whisper', async () => {
      const { spawn } = await import('node:child_process');
      const journal = await createTestJournal(testUser.id);

      const { extractAudio } = await import('../../../src/services/transcription.js');
      await extractAudio(journal.videoPath);

      // Verify FFmpeg was called with correct parameters
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String), // ffmpeg path
        expect.arrayContaining([
          '-i', journal.videoPath,
          '-vn', // No video
          '-acodec', 'pcm_s16le', // 16-bit PCM
          '-ar', '16000', // 16kHz sample rate
          '-ac', '1', // Mono
          '-y', // Overwrite
          expect.any(String), // output path
        ])
      );
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle FFmpeg spawn errors gracefully', async () => {
      const journal = await createTestJournal(testUser.id);

      // Mock FFmpeg to throw error
      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockStream: any = {
          on: vi.fn(function(this: any, event: string, callback: () => void) {
            if (event === 'error') {
              setTimeout(() => callback(new Error('FFmpeg not found')), 10);
            }
            return this;
          }),
          stderr: {
            on: vi.fn(function(this: any) {
              return this;
            }),
          },
        };
        return mockStream;
      });

      const { extractAudio } = await import('../../../src/services/transcription.js');

      await expect(extractAudio(journal.videoPath)).rejects.toThrow();
    }, 10000);

    it('should handle FFmpeg non-zero exit codes', async () => {
      const journal = await createTestJournal(testUser.id);

      // Mock FFmpeg to return error code
      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockStream: any = {
          on: vi.fn(function(this: any, event: string, callback: (code: number) => void) {
            if (event === 'close') {
              setTimeout(() => callback(1), 10); // Exit code 1 = error
            }
            return this;
          }),
          stderr: {
            on: vi.fn(function(this: any, event: string, callback: (data: string) => void) {
              if (event === 'data') {
                callback('FFmpeg error output');
              }
              return this;
            }),
          },
        };
        return mockStream;
      });

      const { extractAudio } = await import('../../../src/services/transcription.js');

      await expect(extractAudio(journal.videoPath)).rejects.toThrow();
    }, 10000);
  });

  describe('Memory Management', () => {
    it('should log memory usage before and after transcription', async () => {
      const journal = await createTestJournal(testUser.id);
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(nodewhisper).mockResolvedValue(mockSRTOutput);

      await service.transcribe({
        journalId: journal.id,
        userId: testUser.id,
        videoPath: journal.videoPath,
      });

      // Verify memory logging occurred
      const memoryLogs = consoleSpy.mock.calls.filter((call) =>
        call[0].includes('[Transcription] Memory')
      );

      expect(memoryLogs.length).toBeGreaterThanOrEqual(2); // Before and after

      consoleSpy.mockRestore();
    });

    it('should log memory at error time when transcription fails', async () => {
      const journal = await createTestJournal(testUser.id);
      const consoleSpy = vi.spyOn(console, 'error');

      vi.mocked(nodewhisper).mockRejectedValue(new Error('Transcription failed'));

      try {
        await service.transcribe({
          journalId: journal.id,
          userId: testUser.id,
          videoPath: journal.videoPath,
        });
      } catch {
        // Expected to throw
      }

      // Verify error memory logging
      const errorMemoryLogs = consoleSpy.mock.calls.filter((call) =>
        call[0].includes('[Transcription] Memory at error time')
      );

      expect(errorMemoryLogs.length).toBe(1);

      consoleSpy.mockRestore();
    });
  });
});
