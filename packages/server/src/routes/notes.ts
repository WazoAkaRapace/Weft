/**
 * Notes API routes
 *
 * Handles CRUD operations for hierarchical notes:
 * - GET /api/notes - Get all notes for the current user
 * - GET /api/notes/:id - Get a single note
 * - POST /api/notes - Create a new note
 * - PUT /api/notes/:id - Update a note
 * - DELETE /api/notes/:id - Soft delete a note
 * - GET /api/notes/:id/journals - Get journals linked to a note
 * - POST /api/notes/:id/journals/:journalId - Link a note to a journal
 * - DELETE /api/notes/:id/journals/:journalId - Unlink a note from a journal
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { notes, journalNotes, journals } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { eq, and, isNull, or, ilike, desc } from 'drizzle-orm';

/**
 * Get all notes for the current user
 *
 * GET /api/notes?parentId=xxx&search=query&includeDeleted=false
 *
 * Query parameters:
 * - parentId: Filter by parent note ID (null for root notes)
 * - search: Text search in title or content
 * - includeDeleted: Include deleted notes (default: false)
 *
 * @returns Response with list of notes or error
 */
export async function handleGetNotes(request: Request): Promise<Response> {
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

    // Parse query parameters
    const url = new URL(request.url);
    const parentIdParam = url.searchParams.get('parentId');
    const search = url.searchParams.get('search');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    // Build query conditions
    const conditions = [eq(notes.userId, session.user.id)];

    // Filter by parent
    if (parentIdParam === 'null' || parentIdParam === '') {
      // Root notes (no parent)
      conditions.push(isNull(notes.parentId));
    } else if (parentIdParam) {
      // Children of specific parent
      conditions.push(eq(notes.parentId, parentIdParam));
    }

    // Filter out deleted notes unless requested
    if (!includeDeleted) {
      conditions.push(isNull(notes.deletedAt));
    }

    // Add text search (in title or content)
    if (search) {
      const searchCondition = or(
        ilike(notes.title, `%${search}%`),
        ilike(notes.content, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Get notes ordered by position and created date
    const userNotes = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(notes.position, desc(notes.createdAt));

    return new Response(
      JSON.stringify({
        notes: userNotes,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get notes error:', error);
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
 * Get a single note by ID
 *
 * GET /api/notes/:id
 *
 * @returns Response with note details or error
 */
export async function handleGetNote(request: Request, noteId: string): Promise<Response> {
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

    return new Response(
      JSON.stringify(note),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get note error:', error);
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
 * Create a new note
 *
 * POST /api/notes
 *
 * Body:
 * - title: string (required)
 * - content: string (optional)
 * - icon: string (optional, default: '📝')
 * - color: string (optional, hex color)
 * - parentId: string | null (optional, for nested notes)
 * - position: number (optional, default: 0)
 *
 * @returns Response with created note or error
 */
export async function handleCreateNote(request: Request): Promise<Response> {
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
      parentId?: string | null;
      position?: number;
    };

    const { title, content, icon, color, parentId, position } = body;

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

    // If parentId is provided, verify it exists and belongs to user
    if (parentId) {
      const parentNotes = await db
        .select()
        .from(notes)
        .where(and(eq(notes.id, parentId), eq(notes.userId, session.user.id)))
        .limit(1);

      if (parentNotes.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Parent note not found',
            code: 'NOT_FOUND',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create note
    const noteId = randomUUID();
    const now = new Date();

    await db.insert(notes).values({
      id: noteId,
      userId: session.user.id,
      title: title.trim(),
      content: content || null,
      icon: icon || '📝',
      color: color || null,
      parentId: parentId || null,
      position: position || 0,
      createdAt: now,
      updatedAt: now,
    });

    // Get created note
    const createdNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    return new Response(
      JSON.stringify(createdNotes[0]),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create note error:', error);
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
 * Update a note by ID
 *
 * PUT /api/notes/:id
 *
 * Body:
 * - title: string (optional)
 * - content: string (optional)
 * - icon: string (optional)
 * - color: string (optional)
 * - parentId: string | null (optional)
 * - position: number (optional)
 *
 * @returns Response with updated note or error
 */
export async function handleUpdateNote(request: Request, noteId: string): Promise<Response> {
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
      parentId?: string | null;
      position?: number;
    };

    const { title, content, icon, color, parentId, position } = body;

    // Get note to verify ownership
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

    // If parentId is being changed, verify it exists and belongs to user
    if (parentId !== undefined && parentId !== null) {
      // Prevent setting a note as its own parent
      if (parentId === noteId) {
        return new Response(
          JSON.stringify({
            error: 'Cannot set note as its own parent',
            code: 'VALIDATION_ERROR',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const parentNotes = await db
        .select()
        .from(notes)
        .where(and(eq(notes.id, parentId), eq(notes.userId, session.user.id)))
        .limit(1);

      if (parentNotes.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Parent note not found',
            code: 'NOT_FOUND',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (position !== undefined) updateData.position = position;

    // Update note
    await db
      .update(notes)
      .set(updateData)
      .where(eq(notes.id, noteId));

    // Get updated note
    const updatedList = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    return new Response(
      JSON.stringify(updatedList[0]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update note error:', error);
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
 * Soft delete a note by ID
 *
 * DELETE /api/notes/:id
 *
 * @returns Response indicating success or error
 */
export async function handleDeleteNote(request: Request, noteId: string): Promise<Response> {
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

    // Get note to verify ownership
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

    // Soft delete note (set deletedAt timestamp)
    await db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(eq(notes.id, noteId));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Note deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete note error:', error);
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
 * Get journals linked to a note
 *
 * GET /api/notes/:id/journals
 *
 * @returns Response with list of linked journals or error
 */
export async function handleGetNoteJournals(request: Request, noteId: string): Promise<Response> {
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

    // Verify note exists and belongs to user
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

    if (note.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get linked journals
    const linkedJournals = await db
      .select({
        id: journals.id,
        userId: journals.userId,
        title: journals.title,
        videoPath: journals.videoPath,
        thumbnailPath: journals.thumbnailPath,
        duration: journals.duration,
        location: journals.location,
        notes: journals.notes,
        createdAt: journals.createdAt,
        updatedAt: journals.updatedAt,
        linkedAt: journalNotes.createdAt,
      })
      .from(journalNotes)
      .innerJoin(journals, eq(journalNotes.journalId, journals.id))
      .where(eq(journalNotes.noteId, noteId))
      .orderBy(desc(journalNotes.createdAt));

    return new Response(
      JSON.stringify({
        journals: linkedJournals,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get note journals error:', error);
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
 * Link a note to a journal
 *
 * POST /api/notes/:id/journals/:journalId
 *
 * @returns Response indicating success or error
 */
export async function handleLinkNoteToJournal(
  request: Request,
  noteId: string,
  journalId: string
): Promise<Response> {
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

    // Verify note exists and belongs to user
    const noteList = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    const note = noteList[0];

    if (!note || note.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Note not found or unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify journal exists and belongs to user
    const journalList = await db
      .select()
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);

    const journal = journalList[0];

    if (!journal || journal.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Journal not found or unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if link already exists
    const existingLinks = await db
      .select()
      .from(journalNotes)
      .where(and(eq(journalNotes.noteId, noteId), eq(journalNotes.journalId, journalId)))
      .limit(1);

    if (existingLinks.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Note is already linked to this journal',
          code: 'ALREADY_EXISTS',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create link
    const linkId = randomUUID();
    await db.insert(journalNotes).values({
      id: linkId,
      noteId,
      journalId,
      createdAt: new Date(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Note linked to journal successfully',
        linkId,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Link note to journal error:', error);
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
 * Reorder notes - updates positions and optionally parentIds for multiple notes
 *
 * POST /api/notes/reorder
 *
 * Body:
 * - notes: Array of { id: string, position: number, parentId?: string | null }
 *
 * @returns Response indicating success or error
 */
export async function handleReorderNotes(request: Request): Promise<Response> {
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
      notes?: Array<{ id: string; position: number; parentId?: string | null }>;
    };

    const { notes: notesToReorder } = body;

    // Validate input
    if (!notesToReorder || !Array.isArray(notesToReorder) || notesToReorder.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'notes array is required',
          code: 'VALIDATION_ERROR',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all notes to verify ownership
    const existingNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

    const noteMap = new Map(existingNotes.map(n => [n.id, n]));

    // Verify all notes exist and belong to user
    for (const item of notesToReorder) {
      const note = noteMap.get(item.id);
      if (!note) {
        return new Response(
          JSON.stringify({
            error: `Note ${item.id} not found`,
            code: 'NOT_FOUND',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // If parentId is being changed, verify the new parent exists and belongs to user
      if (item.parentId !== undefined && item.parentId !== null) {
        const newParent = noteMap.get(item.parentId);
        if (!newParent) {
          return new Response(
            JSON.stringify({
              error: `Parent note ${item.parentId} not found`,
              code: 'NOT_FOUND',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Prevent creating a cycle (a note cannot be its own ancestor)
        if (item.id === item.parentId) {
          return new Response(
            JSON.stringify({
              error: 'A note cannot be its own parent',
              code: 'VALIDATION_ERROR',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Update positions and parentIds
    for (const item of notesToReorder) {
      const updateData: { position: number; parentId?: string | null; updatedAt: Date } = {
        position: item.position,
        updatedAt: new Date(),
      };

      // Only update parentId if it's explicitly provided
      if (item.parentId !== undefined) {
        updateData.parentId = item.parentId;
      }

      await db
        .update(notes)
        .set(updateData)
        .where(eq(notes.id, item.id));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notes reordered successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reorder notes error:', error);
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
 * Unlink a note from a journal
 *
 * DELETE /api/notes/:id/journals/:journalId
 *
 * @returns Response indicating success or error
 */
export async function handleUnlinkNoteFromJournal(
  request: Request,
  noteId: string,
  journalId: string
): Promise<Response> {
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

    // Verify note exists and belongs to user
    const noteList = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    const note = noteList[0];

    if (!note || note.userId !== session.user.id) {
      return new Response(
        JSON.stringify({
          error: 'Note not found or unauthorized',
          code: 'PERMISSION_DENIED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete link
    await db
      .delete(journalNotes)
      .where(and(eq(journalNotes.noteId, noteId), eq(journalNotes.journalId, journalId)));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Note unlinked from journal successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unlink note from journal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
