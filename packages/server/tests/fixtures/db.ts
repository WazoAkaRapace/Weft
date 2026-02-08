/**
 * Database test fixtures
 * Provides helper functions for creating test data in the database
 */

import { randomUUID } from 'node:crypto';
import { getTestDb } from '../setup.js';
import * as schema from '../../src/db/schema.js';
import type { NewJournal, NewNote, NewTemplate, NewTranscript, NewJournalNote } from '../../src/db/schema.js';

/**
 * Create a test journal entry
 */
export async function createTestJournal(userId: string, overrides: Partial<NewJournal> = {}) {
  const db = getTestDb();

  const journalId = overrides.id || randomUUID();
  const now = new Date();

  const journalData: NewJournal = {
    id: journalId,
    userId,
    title: overrides.title || 'Test Journal Entry',
    videoPath: overrides.videoPath || `/uploads/${journalId}.webm`,
    thumbnailPath: overrides.thumbnailPath || `/uploads/${journalId}.jpg`,
    duration: overrides.duration || 60,
    location: overrides.location || null,
    notes: overrides.notes || null,
    manualMood: overrides.manualMood || null,
    dominantEmotion: overrides.dominantEmotion || null,
    emotionTimeline: overrides.emotionTimeline || null,
    emotionScores: overrides.emotionScores || null,
    hlsManifestPath: overrides.hlsManifestPath || null,
    hlsStatus: overrides.hlsStatus || null,
    hlsError: overrides.hlsError || null,
    hlsCreatedAt: overrides.hlsCreatedAt || null,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };

  const journals = await db
    .insert(schema.journals)
    .values(journalData)
    .returning();

  return journals[0];
}

/**
 * Create a test note
 */
export async function createTestNote(userId: string, overrides: Partial<NewNote> = {}) {
  const db = getTestDb();

  const noteId = overrides.id || randomUUID();
  const now = new Date();

  const noteData: NewNote = {
    id: noteId,
    userId,
    title: overrides.title || 'Test Note',
    content: overrides.content || 'Test note content',
    icon: overrides.icon || '📝',
    color: overrides.color || null,
    parentId: overrides.parentId || null,
    position: overrides.position ?? 0,
    deletedAt: overrides.deletedAt || null,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };

  const notes = await db
    .insert(schema.notes)
    .values(noteData)
    .returning();

  return notes[0];
}

/**
 * Create a test template
 */
export async function createTestTemplate(userId: string, overrides: Partial<NewTemplate> = {}) {
  const db = getTestDb();

  const templateId = overrides.id || randomUUID();
  const now = new Date();

  const templateData: NewTemplate = {
    id: templateId,
    userId,
    title: overrides.title || 'Test Template',
    content: overrides.content || 'Template content with {{placeholder}}',
    icon: overrides.icon || '📋',
    color: overrides.color || null,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };

  const templates = await db
    .insert(schema.templates)
    .values(templateData)
    .returning();

  return templates[0];
}

/**
 * Create a test transcript for a journal
 */
export async function createTestTranscript(journalId: string, overrides: Partial<NewTranscript> = {}) {
  const db = getTestDb();

  const transcriptId = overrides.id || randomUUID();
  const now = new Date();

  const transcriptData: NewTranscript = {
    id: transcriptId,
    journalId,
    text: overrides.text || 'This is a test transcript with some sample text.',
    segments: overrides.segments || [
      { start: 0, end: 2.5, text: 'This is a test', confidence: 0.95 },
      { start: 2.5, end: 5.0, text: 'transcript with', confidence: 0.92 },
      { start: 5.0, end: 7.5, text: 'some sample text.', confidence: 0.98 },
    ],
    createdAt: overrides.createdAt || now,
  };

  const transcripts = await db
    .insert(schema.transcripts)
    .values(transcriptData)
    .returning();

  return transcripts[0];
}

/**
 * Link a note to a journal
 */
export async function linkNoteToJournal(noteId: string, journalId: string) {
  const db = getTestDb();

  const linkId = randomUUID();
  const now = new Date();

  const linkData: NewJournalNote = {
    id: linkId,
    noteId,
    journalId,
    createdAt: now,
  };

  const links = await db
    .insert(schema.journalNotes)
    .values(linkData)
    .returning();

  return links[0];
}

/**
 * Create a test journal with transcript
 */
export async function createTestJournalWithTranscript(userId: string, overrides: Partial<NewJournal> = {}) {
  const journal = await createTestJournal(userId, overrides);
  await createTestTranscript(journal.id);
  return journal;
}

/**
 * Create a set of test notes with hierarchy
 */
export async function createTestNoteHierarchy(userId: string, depth = 2, childrenPerNode = 2) {
  const db = getTestDb();
  const createdNotes: string[] = [];

  async function createNode(parentId: string | null, currentDepth: number): Promise<void> {
    if (currentDepth > depth) return;

    for (let i = 0; i < childrenPerNode; i++) {
      const note = await createTestNote(userId, {
        parentId,
        title: parentId ? `Child Note ${i}` : `Root Note ${i}`,
        position: i,
      });
      createdNotes.push(note.id);

      await createNode(note.id, currentDepth + 1);
    }
  }

  await createNode(null, 0);

  return createdNotes;
}
