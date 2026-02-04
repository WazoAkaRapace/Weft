/**
 * Templates API routes
 *
 * Handles CRUD operations for user-specific note templates:
 * - GET /api/templates - Get all templates for the current user
 * - GET /api/templates/:id - Get a single template
 * - POST /api/templates - Create a new template
 * - PUT /api/templates/:id - Update a template
 * - DELETE /api/templates/:id - Delete a template
 * - POST /api/templates/from-note/:noteId - Create template from existing note
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { templates, notes } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { eq, desc } from 'drizzle-orm';

/**
 * Get all templates for the current user
 *
 * GET /api/templates
 *
 * @returns Response with list of templates or error
 */
export async function handleGetTemplates(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get templates ordered by creation date
    const userTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.userId, session.user.id))
      .orderBy(desc(templates.createdAt));

    return new Response(
      JSON.stringify({
        templates: userTemplates,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get templates error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get a single template by ID
 *
 * GET /api/templates/:id
 *
 * @returns Response with template details or error
 */
export async function handleGetTemplate(request: Request, templateId: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get template
    const templateList = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    const template = templateList[0];

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'Template not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (template.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(template),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get template error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Create a new template
 *
 * POST /api/templates
 *
 * Body:
 * - title: string (required)
 * - content: string (optional)
 * - icon: string (optional, default: '📝')
 * - color: string (optional, hex color)
 *
 * @returns Response with created template or error
 */
export async function handleCreateTemplate(request: Request): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
      icon?: string;
      color?: string;
    };

    const { title, content, icon, color } = body;

    // Validate title
    if (!title || title.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Title is required',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create template
    const templateId = randomUUID();
    const now = new Date();

    await db.insert(templates).values({
      id: templateId,
      userId: session.user.id,
      title: title.trim(),
      content: content || null,
      icon: icon || '📝',
      color: color || null,
      createdAt: now,
      updatedAt: now,
    });

    // Get created template
    const createdTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    return new Response(
      JSON.stringify(createdTemplates[0]),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create template error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update a template by ID
 *
 * PUT /api/templates/:id
 *
 * Body:
 * - title: string (optional)
 * - content: string (optional)
 * - icon: string (optional)
 * - color: string (optional)
 *
 * @returns Response with updated template or error
 */
export async function handleUpdateTemplate(request: Request, templateId: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
      icon?: string;
      color?: string;
    };

    const { title, content, icon, color } = body;

    // Get template to verify ownership
    const templateList = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    const template = templateList[0];

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'Template not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (template.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;

    // Update template
    await db
      .update(templates)
      .set(updateData)
      .where(eq(templates.id, templateId));

    // Get updated template
    const updatedList = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    return new Response(
      JSON.stringify(updatedList[0]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update template error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete a template by ID
 *
 * DELETE /api/templates/:id
 *
 * @returns Response indicating success or error
 */
export async function handleDeleteTemplate(request: Request, templateId: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get template to verify ownership
    const templateList = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    const template = templateList[0];

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'Template not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (template.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete template
    await db
      .delete(templates)
      .where(eq(templates.id, templateId));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete template error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Create a template from an existing note
 *
 * POST /api/templates/from-note/:noteId
 *
 * @returns Response with created template or error
 */
export async function handleCreateTemplateFromNote(request: Request, noteId: string): Promise<Response> {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get note
    const noteList = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    const note = noteList[0];

    if (!note) {
      return new Response(
        JSON.stringify({
          error: 'Note not found',
          code: 'NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (note.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create template from note
    const templateId = randomUUID();
    const now = new Date();

    await db.insert(templates).values({
      id: templateId,
      userId: session.user.id,
      title: note.title,
      content: note.content,
      icon: note.icon,
      color: note.color,
      createdAt: now,
      updatedAt: now,
    });

    // Get created template
    const createdTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    return new Response(
      JSON.stringify(createdTemplates[0]),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create template from note error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
