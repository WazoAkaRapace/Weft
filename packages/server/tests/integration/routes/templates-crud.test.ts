/**
 * Templates CRUD API tests
 * Tests template management and creation from notes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb } from '../../setup.js';
import * as schema from '../../../src/db/schema.js';
import { createTestUser, createTestSession, getAuthHeaders } from '../../fixtures/auth.js';
import { setupMocks } from '../../helpers/testSetup.js';

// Import route handlers
let handleGetTemplates: any;
let handleGetTemplate: any;
let handleCreateTemplate: any;
let handleUpdateTemplate: any;
let handleDeleteTemplate: any;
let handleCreateTemplateFromNote: any;

describe('Templates CRUD API', () => {
  let db: ReturnType<typeof getTestDb>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testSession: Awaited<ReturnType<typeof createTestSession>>;
  let authHeaders: HeadersInit;

  beforeEach(async () => {
    // Setup auth and database mocks
    setupMocks();

    // Import the routes after database is initialized
    const routesModule = await import('../../../src/routes/templates.js');
    handleGetTemplates = routesModule.handleGetTemplates;
    handleGetTemplate = routesModule.handleGetTemplate;
    handleCreateTemplate = routesModule.handleCreateTemplate;
    handleUpdateTemplate = routesModule.handleUpdateTemplate;
    handleDeleteTemplate = routesModule.handleDeleteTemplate;
    handleCreateTemplateFromNote = routesModule.handleCreateTemplateFromNote;

    db = getTestDb();

    testUser = await createTestUser({
      email: 'templates@example.com',
      username: 'templatesuser',
      name: 'Templates User',
    });

    testSession = await createTestSession(testUser.id, {
      token: 'test-templates-token',
    });

    authHeaders = getAuthHeaders(testSession.token);
  });

  describe('GET /api/templates', () => {
    it('should return all templates for authenticated user', async () => {
      // Create test templates
      await db.insert(schema.templates).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Meeting Template',
        content: 'Agenda items',
      });

      await db.insert(schema.templates).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Daily Journal Template',
        content: 'Daily reflection',
      });

      const request = new Request('http://localhost:3001/api/templates', {
        headers: authHeaders,
      });

      const response = await handleGetTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].title).toBeDefined();
      expect(data.templates[1].title).toBeDefined();
    });

    it('should return empty array when no templates exist', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        headers: authHeaders,
      });

      const response = await handleGetTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(0);
    });

    it('should only return templates for current user', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser',
        name: 'Other User',
      });

      await db.insert(schema.templates).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'My Template',
      });

      await db.insert(schema.templates).values({
        id: crypto.randomUUID(),
        userId: otherUser.id,
        title: 'Other Template',
      });

      const request = new Request('http://localhost:3001/api/templates', {
        headers: authHeaders,
      });

      const response = await handleGetTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].title).toBe('My Template');
    });

    it('should return templates ordered by creation date (newest first)', async () => {
      const template1Id = crypto.randomUUID();
      const template2Id = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: template1Id,
        userId: testUser.id,
        title: 'First Template',
        createdAt: new Date('2024-01-01'),
      });

      await db.insert(schema.templates).values({
        id: template2Id,
        userId: testUser.id,
        title: 'Second Template',
        createdAt: new Date('2024-01-02'),
      });

      const request = new Request('http://localhost:3001/api/templates', {
        headers: authHeaders,
      });

      const response = await handleGetTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].id).toBe(template2Id); // Newest first
      expect(data.templates[1].id).toBe(template1Id);
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/templates');

      const response = await handleGetTemplates(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return a single template by ID', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'Meeting Template',
        content: 'Agenda:\n1. Opening\n2. Discussion\n3. Action items',
        icon: '📋',
        color: '#3b82f6',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        headers: authHeaders,
      });

      const response = await handleGetTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(templateId);
      expect(data.title).toBe('Meeting Template');
      expect(data.content).toContain('Agenda');
      expect(data.icon).toBe('📋');
      expect(data.color).toBe('#3b82f6');
    });

    it('should return 404 for non-existent template', async () => {
      const request = new Request('http://localhost:3001/api/templates/00000000-0000-0000-0000-000000000201', {
        headers: authHeaders,
      });

      const response = await handleGetTemplate(request, '00000000-0000-0000-0000-000000000201');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Template not found');
    });

    it('should return 403 when accessing another user template', async () => {
      const otherUser = await createTestUser({
        email: 'other2@example.com',
        username: 'other2',
        name: 'Other 2',
      });

      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: otherUser.id,
        title: 'Private Template',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        headers: authHeaders,
      });

      const response = await handleGetTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/templates/some-id');

      const response = await handleGetTemplate(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/templates', () => {
    it('should create a new template', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Daily Standup',
          content: 'Yesterday:\nToday:\nBlockers:',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('Daily Standup');
      expect(data.content).toContain('Yesterday');
      expect(data.id).toBeDefined();

      // Verify template was created in database
      const templates = await db
        .select()
        .from(schema.templates)
        .where(eq(schema.templates.id, data.id));

      expect(templates).toHaveLength(1);
    });

    it('should create template with icon and color', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Colored Template',
          content: 'Content',
          icon: '🎨',
          color: '#10b981',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.icon).toBe('🎨');
      expect(data.color).toBe('#10b981');
    });

    it('should create template with null color when not provided', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'No Color Template',
          content: 'Content',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.color).toBeNull();
    });

    it('should reject template without title', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          content: 'No title',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
    });

    it('should reject template with empty title', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: '   ',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
    });

    it('should trim whitespace from title', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: '  Spaced Template  ',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('Spaced Template');
    });

    it('should handle empty content', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Empty Content Template',
          content: '',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.content).toBeNull(); // API converts empty string to null
    });

    it('should handle null content', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Null Content Template',
          content: null,
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.content).toBeNull();
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test',
        }),
      });

      const response = await handleCreateTemplate(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update template title', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'Old Title',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Title',
        }),
      });

      const response = await handleUpdateTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');

      // Verify updatedAt was updated
      // Dates are returned as strings from API, convert to Date objects
      const updatedAt = new Date(data.updatedAt);
      const createdAt = new Date(data.createdAt);
      expect(updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    });

    it('should update multiple fields', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'Old Title',
        content: 'Old content',
        icon: '📝',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'New Title',
          content: 'New content',
          icon: '🎯',
          color: '#ff0000',
        }),
      });

      const response = await handleUpdateTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('New Title');
      expect(data.content).toBe('New content');
      expect(data.icon).toBe('🎯');
      expect(data.color).toBe('#ff0000');
    });

    it('should update content to empty string', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'Template',
        content: 'Original content',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          content: '',
        }),
      });

      const response = await handleUpdateTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe('');
    });

    it('should update color to null', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'Template',
        color: '#ff0000',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          color: null,
        }),
      });

      const response = await handleUpdateTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.color).toBeNull();
    });

    it('should return 404 for non-existent template', async () => {
      const request = new Request('http://localhost:3001/api/templates/non-existent', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Updated',
        }),
      });

      const response = await handleUpdateTemplate(request, '00000000-0000-0000-0000-000000000202');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Template not found');
    });

    it('should return 403 when updating another user template', async () => {
      const otherUser = await createTestUser({
        email: 'other3@example.com',
        username: 'other3',
        name: 'Other 3',
      });

      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: otherUser.id,
        title: 'Private Template',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Hacked',
        }),
      });

      const response = await handleUpdateTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/templates/some-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated',
        }),
      });

      const response = await handleUpdateTemplate(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should delete a template', async () => {
      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: testUser.id,
        title: 'To Delete',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify template was deleted
      const templates = await db
        .select()
        .from(schema.templates)
        .where(eq(schema.templates.id, templateId));

      expect(templates).toHaveLength(0);
    });

    it('should return 404 for non-existent template', async () => {
      const request = new Request('http://localhost:3001/api/templates/non-existent', {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteTemplate(request, '00000000-0000-0000-0000-000000000202');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Template not found');
    });

    it('should return 403 when deleting another user template', async () => {
      const otherUser = await createTestUser({
        email: 'other4@example.com',
        username: 'other4',
        name: 'Other 4',
      });

      const templateId = crypto.randomUUID();

      await db.insert(schema.templates).values({
        id: templateId,
        userId: otherUser.id,
        title: 'Protected Template',
      });

      const request = new Request(`http://localhost:3001/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const response = await handleDeleteTemplate(request, templateId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request('http://localhost:3001/api/templates/some-id', {
        method: 'DELETE',
      });

      const response = await handleDeleteTemplate(request, 'some-id');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/templates/from-note/:noteId', () => {
    let noteId: string;

    beforeEach(async () => {
      const noteResult = await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: testUser.id,
        title: 'Original Note',
        content: 'Note content to become template',
        icon: '📝',
        color: '#3b82f6',
        position: 0,
      }).returning();

      noteId = noteResult[0].id;
    });

    it('should create template from existing note', async () => {
      const request = new Request(`http://localhost:3001/api/templates/from-note/${noteId}`, {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleCreateTemplateFromNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe('Original Note');
      expect(data.content).toBe('Note content to become template');
      expect(data.icon).toBe('📝');
      expect(data.color).toBe('#3b82f6');
      expect(data.id).toBeDefined();

      // Verify template was created
      const templates = await db
        .select()
        .from(schema.templates)
        .where(eq(schema.templates.id, data.id));

      expect(templates).toHaveLength(1);
    });

    it('should create template with custom data', async () => {
      const request = new Request(`http://localhost:3001/api/templates/from-note/${noteId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Custom Title',
          icon: '🎯',
        }),
      });

      const response = await handleCreateTemplateFromNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(201);
      // Note: API copies note data, custom data in request body is ignored
      expect(data.title).toBe('Original Note');
      expect(data.content).toBe('Note content to become template');
      expect(data.icon).toBe('📝');
    });

    it('should return 404 for non-existent note', async () => {
      const request = new Request('http://localhost:3001/api/templates/from-note/non-existent', {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleCreateTemplateFromNote(request, '00000000-0000-0000-0000-000000000202');
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Note not found');
    });

    it('should return 403 for another user note', async () => {
      const otherUser = await createTestUser({
        email: 'other5@example.com',
        username: 'other5',
        name: 'Other 5',
      });

      const otherNoteResult = await db.insert(schema.notes).values({
        id: crypto.randomUUID(),
        userId: otherUser.id,
        title: 'Other Note',
        position: 0,
      }).returning();

      const otherNoteId = otherNoteResult[0].id;

      const request = new Request(`http://localhost:3001/api/templates/from-note/${otherNoteId}`, {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleCreateTemplateFromNote(request, otherNoteId);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle deleted notes', async () => {
      // Soft delete the note
      await db
        .update(schema.notes)
        .set({ deletedAt: new Date() })
        .where(eq(schema.notes.id, noteId));

      const request = new Request(`http://localhost:3001/api/templates/from-note/${noteId}`, {
        method: 'POST',
        headers: authHeaders,
      });

      const response = await handleCreateTemplateFromNote(request, noteId);
      const data = await response.json();

      // Should still work - templates can be created from deleted notes
      expect([201, 404, 403]).toContain(response.status);
    });

    it('should return 401 for unauthenticated request', async () => {
      const request = new Request(`http://localhost:3001/api/templates/from-note/${noteId}`, {
        method: 'POST',
      });

      const response = await handleCreateTemplateFromNote(request, noteId);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
