/**
 * Notes CRUD API tests
 * Tests hierarchical notes CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and, isNull } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import {
  handleGetNotes,
  handleGetNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleReorderNotes,
  handleGetNoteJournals,
  handleLinkNoteToJournal,
  handleUnlinkNoteFromJournal,
} from '../../../src/routes/notes.js';
import { createTestJournal, createTestTranscript } from '../../fixtures/db.js';

describe('Notes CRUD API', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    db = getTestDb();

    testUser = await createTestUser({
      email: 'notes@example.com',
      username: 'notesuser',
      name: 'Notes User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-notes-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('GET /api/notes', () => {
    it('should return all notes for authenticated user', async () => {
      // Create test notes
      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'First Note',
        content: 'Content 1',
        position: 0,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Second Note',
        content: 'Content 2',
        position: 1,
      });

      const request = new Request('http://localhost:3001/api/notes', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(2);
      expect(data.notes[0].title).toBe('First Note');
      expect(data.notes[1].title).toBe('Second Note');
    });

    it('should filter by parentId for root notes', async () => {
      const rootId = crypto.randomUUID();
      const childId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: rootId,
        userId: testUser.id,
        title: 'Root Note',
        position: 0,
        parentId: null,
      });

      await db.insert(schema.notes).values({
        id: childId,
        userId: testUser.id,
        title: 'Child Note',
        position: 0,
        parentId: rootId,
      });

      // Get root notes
      const rootRequest = new Request('http://localhost:3001/api/notes?parentId=null', {
        headers: authHeaders,
      });

      const rootResponse = await handleGetNotes(rootRequest);
      const rootData = await rootResponse.json();

      expect(rootResponse.status).toBe(200);
      expect(rootData.notes).toHaveLength(1);
      expect(rootData.notes[0].id).toBe(rootId);
      expect(rootData.notes[0].parentId).toBeNull();

      // Get child notes
      const childRequest = new Request(`http://localhost:3001/api/notes?parentId=${rootId}`, {
        headers: authHeaders,
      });

      const childResponse = await handleGetNotes(childRequest);
      const childData = await childResponse.json();

      expect(childResponse.status).toBe(200);
      expect(childData.notes).toHaveLength(1);
      expect(childData.notes[0].id).toBe(childId);
      expect(childData.notes[0].parentId).toBe(rootId);
    });

    it('should search notes by title and content', async () => {
      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Important Task',
        content: 'This is important content',
        position: 0,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Regular Note',
        content: 'Just a regular note',
        position: 1,
      });

      const request = new Request('http://localhost:3001/api/notes?search=important', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].title).toBe('Important Task');
    });

    it('should exclude deleted notes by default', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'Active Note',
        position: 0,
        deletedAt: null,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Deleted Note',
        position: 1,
        deletedAt: new Date(),
      });

      const request = new Request('http://localhost:3001/api/notes', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].title).toBe('Active Note');
    });

    it('should include deleted notes when requested', async () => {
      const deletedId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: deletedId,
        userId: testUser.id,
        title: 'Deleted Note',
        position: 0,
        deletedAt: new Date(),
      });

      const request = new Request('http://localhost:3001/api/notes?includeDeleted=true', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].id).toBe(deletedId);
    });

    it('should only return notes for current user', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        name: 'Other User',
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'My Note',
        position: 0,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: otherUser.id,
        title: 'Other Note',
        position: 0,
      });

      const request = new Request('http://localhost:3001/api/notes', {
        headers: authHeaders,
      });

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].title).toBe('My Note');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes');

      const response = await handleGetNotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should return a single note by ID', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'Test Note',
        content: 'Test content',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(noteId);
      expect(data.title).toBe('Test Note');
      expect(data.content).toBe('Test content');
    });

    it('should return 404 for non-existent note', async () => {
      const request = new Request('http://localhost:3001/api/notes/non-existent-id', {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, 'non-existent-id');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Note not found');
    });

    it('should return 403 when accessing another user note', async () => {
      const otherUser = await createTestUser({
        email: 'otheruser2@example.com',
        username: 'otheruser2',
        name: 'Other User 2',
      });

      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: otherUser.id,
        title: 'Private Note',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        headers: authHeaders,
      });

      const response = await handleGetNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes/some-id');

      const response = await handleGetNote(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/notes', () => {
    it('should create a new note', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Note',
          content: 'New content',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('New Note');
      expect(data.content).toBe('New content');
      expect(data.id).toBeDefined();

      // Verify note was created in database
      const notes = await db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.id, data.id));

      expect(notes).toHaveLength(1);
    });

    it('should create note with default icon and color', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Default Note',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.icon).toBe('📝');
      expect(data.color).toBeNull();
    });

    it('should create nested note with parentId', async () => {
      const parentId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: parentId,
        userId: testUser.id,
        title: 'Parent Note',
        position: 0,
      });

      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Child Note',
          parentId: parentId,
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.parentId).toBe(parentId);
    });

    it('should reject note with invalid parentId', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Orphan Note',
          parentId: 'invalid-parent-id',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Parent note not found');
    });

    it('should reject note without title', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          content: 'No title',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
    });

    it('should reject note with empty title', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: '   ',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
    });

    it('should trim whitespace from title', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: '  Spaced Title  ',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('Spaced Title');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test',
        }),
      });

      const response = await handleCreateNote(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update note title', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'Old Title',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Title',
        }),
      });

      const response = await handleUpdateNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');

      // Verify updatedAt was updated
      expect(data.updatedAt.getTime()).toBeGreaterThan(data.createdAt.getTime());
    });

    it('should update multiple fields', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'Old Title',
        content: 'Old content',
        icon: '📝',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Title',
          content: 'New content',
          icon: '🎯',
          color: '#ff0000',
        }),
      });

      const response = await handleUpdateNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');
      expect(data.content).toBe('New content');
      expect(data.icon).toBe('🎯');
      expect(data.color).toBe('#ff0000');
    });

    it('should return 404 for non-existent note', async () => {
      const request = new Request('http://localhost:3001/api/notes/non-existent', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Updated',
        }),
      });

      const response = await handleUpdateNote(request, 'non-existent');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Note not found');
    });

    it('should return 403 when updating another user note', async () => {
      const otherUser = await createTestUser({
        email: 'other3@example.com',
        username: 'other3',
        name: 'Other 3',
      });

      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: otherUser.id,
        title: 'Private Note',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Hacked',
        }),
      });

      const response = await handleUpdateNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes/some-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated',
        }),
      });

      const response = await handleUpdateNote(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should soft delete a note', async () => {
      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: testUser.id,
        title: 'To Delete',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify note is soft deleted (deletedAt is set, but record exists)
      const notes = await db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.id, noteId));

      expect(notes).toHaveLength(1);
      expect(notes[0].deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent note', async () => {
      const request = new Request('http://localhost:3001/api/notes/non-existent', {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteNote(request, 'non-existent');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Note not found');
    });

    it('should return 403 when deleting another user note', async () => {
      const otherUser = await createTestUser({
        email: 'other4@example.com',
        username: 'other4',
        name: 'Other 4',
      });

      const noteId = crypto.randomUUID();

      await db.insert(schema.notes).values({
        id: noteId,
        userId: otherUser.id,
        title: 'Protected Note',
        position: 0,
      });

      const request = new Request(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes/some-id', {
        method: 'DELETE',
      });

      const response = await handleDeleteNote(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/notes/reorder', () => {
    beforeEach(async () => {
      // Create test notes
      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Note 1',
        position: 0,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Note 2',
        position: 1,
      });

      await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Note 3',
        position: 2,
      });
    });

    it('should reorder notes', async () => {
      const notes = await db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.userId, testUser.id))
        .orderBy(schema.notes.position);

      const noteIds = notes.map(n => n.id);

      // Reverse order
      const request = new Request('http://localhost:3001/api/notes/reorder', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          noteIds: [noteIds[2], noteIds[1], noteIds[0]],
        }),
      });

      const response = await handleReorderNotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify new order
      const reorderedNotes = await db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.userId, testUser.id))
        .orderBy(schema.notes.position);

      expect(reorderedNotes[0].id).toBe(noteIds[2]);
      expect(reorderedNotes[1].id).toBe(noteIds[1]);
      expect(reorderedNotes[2].id).toBe(noteIds[0]);
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/notes/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteIds: ['id1', 'id2'],
        }),
      });

      const response = await handleReorderNotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Note-Journal Relationships', () => {
    let noteId: string;
    let journalId: string;

    beforeEach(async () => {
      // Create test note
      const noteResult = await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Linked Note',
        position: 0,
      }).returning();

      noteId = noteResult[0].id;

      // Create test journal
      const journalResult = await db.insert(schema.journals).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Test Journal',
        videoPath: '/uploads/test.webm',
        duration: 60,
      }).returning();

      journalId = journalResult[0].id;
    });

    describe('GET /api/notes/:id/journals', () => {
      it('should return journals linked to a note', async () => {
        // Link note to journal
        await db.insert(schema.journalNotes).values({
          journalId: journalId,
          noteId: noteId,
        });

        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals`, {
          headers: authHeaders,
        });

        const response = await handleGetNoteJournals(request, noteId);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.journals).toHaveLength(1);
        expect(data.journals[0].id).toBe(journalId);
      });

      it('should return empty array for note with no linked journals', async () => {
        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals`, {
          headers: authHeaders,
        });

        const response = await handleGetNoteJournals(request, noteId);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.journals).toHaveLength(0);
      });

      it('should return 401 for unauthenticated request', async () => {
        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals`);

        const response = await handleGetNoteJournals(request, noteId);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('POST /api/notes/:id/journals/:journalId', () => {
      it('should link a note to a journal', async () => {
        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals/${journalId}`, {
          method: 'POST',
          headers: authHeaders,
        });

        const response = await handleLinkNoteToJournal(request, noteId, journalId);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify link was created
        const links = await db
          .select()
          .from(schema.journalNotes)
          .where(
            and(
              eq(schema.journalNotes.noteId, noteId),
              eq(schema.journalNotes.journalId, journalId)
            )
          );

        expect(links).toHaveLength(1);
      });

      it('should return 404 for non-existent note', async () => {
        const request = new Request('http://localhost:3001/api/notes/non-existent/journals/test-journal', {
          method: 'POST',
          headers: authHeaders,
        });

        const response = await handleLinkNoteToJournal(request, 'non-existent', 'test-journal');
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Note not found');
      });

      it('should return 401 for unauthenticated request', async () => {
        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals/${journalId}`, {
          method: 'POST',
        });

        const response = await handleLinkNoteToJournal(request, noteId, journalId);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('DELETE /api/notes/:id/journals/:journalId', () => {
      it('should unlink a note from a journal', async () => {
        // Create link first
        await db.insert(schema.journalNotes).values({
          journalId: journalId,
          noteId: noteId,
        });

        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals/${journalId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        const response = await handleUnlinkNoteFromJournal(request, noteId, journalId);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify link was deleted
        const links = await db
          .select()
          .from(schema.journalNotes)
          .where(
            and(
              eq(schema.journalNotes.noteId, noteId),
              eq(schema.journalNotes.journalId, journalId)
            )
          );

        expect(links).toHaveLength(0);
      });

      it('should return 401 for unauthenticated request', async () => {
        const request = new Request(`http://localhost:3001/api/notes/${noteId}/journals/${journalId}`, {
          method: 'DELETE',
        });

        const response = await handleUnlinkNoteFromJournal(request, noteId, journalId);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });
  });
});
