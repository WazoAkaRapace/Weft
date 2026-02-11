/**
 * Input Validation Schemas
 *
 * Provides Zod-based validation schemas for all API endpoints.
 * These schemas ensure runtime type safety and input validation.
 *
 * NOTE: This module requires 'zod' to be installed.
 * Run: pnpm --filter @weft/server add zod
 */

import { z } from 'zod';
import { APIError, ErrorCode } from './errors.js';

/**
 * Common validation patterns
 */
export const commonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  optionalString: z.string().optional().nullable(),
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().nonnegative(),
  date: z.coerce.date(),
  dateString: z.string().datetime(),
  emotionType: z.enum(['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise']),
  moodType: z.enum(['happy', 'sad', 'angry', 'neutral', 'sick', 'anxious', 'tired', 'excited', 'fear', 'disgust', 'surprise']),
  timeOfDay: z.enum(['morning', 'afternoon']),
  hlsStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
};

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Date range query parameters
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Search query parameters
 */
export const searchSchema = z.object({
  search: z.string().max(200).optional(),
});

/**
 * Journal creation schema
 */
export const createJournalSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  manualMood: commonSchemas.moodType.optional().nullable(),
});

/**
 * Journal update schema
 */
export const updateJournalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  notes: z.string().max(10000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  manualMood: commonSchemas.moodType.optional().nullable(),
});

/**
 * Note creation schema
 */
export const createNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(100000).optional().nullable(),
  icon: z.string().max(10).default('📝'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  position: z.number().int().nonnegative().default(0),
});

/**
 * Note update schema
 */
export const updateNoteSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(100000).optional().nullable(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  position: z.number().int().nonnegative().optional(),
});

/**
 * Note reorder schema
 */
export const reorderNotesSchema = z.object({
  notes: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int().nonnegative(),
    parentId: z.string().uuid().optional().nullable(),
  })).min(1).max(100),
});

/**
 * Template creation schema
 */
export const createTemplateSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(100000).optional().nullable(),
  icon: z.string().max(10).default('📝'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

/**
 * Template update schema
 */
export const updateTemplateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(100000).optional().nullable(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

/**
 * Daily mood upsert schema
 */
export const upsertMoodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mood: commonSchemas.moodType,
  timeOfDay: commonSchemas.timeOfDay,
  notes: z.string().max(5000).optional().nullable(),
});

/**
 * User settings update schema
 */
export const updateUserSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  preferredLanguage: z.string().length(2).optional(),
  transcriptionModel: z.string().optional(),
});

/**
 * First user creation schema
 */
export const createFirstUserSchema = z.object({
  name: z.string().min(1).max(100),
  username: commonSchemas.username,
  email: commonSchemas.email,
  password: commonSchemas.password,
  preferredLanguage: z.string().length(2).default('en'),
});

/**
 * Backup creation schema
 */
export const createBackupSchema = z.object({
  includeFiles: z.boolean().default(true),
});

/**
 * Restore schema
 */
export const restoreSchema = z.object({
  strategy: z.enum(['merge', 'replace', 'skip']).default('merge'),
});

/**
 * Validate request body against a schema
 *
 * @throws APIError with VALIDATION_ERROR code if validation fails
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  requestId?: string
): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    throw new APIError(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      {
        requestId,
        details: { errors },
      }
    );
  }

  return result.data;
}

/**
 * Validate query parameters against a schema
 *
 * @throws APIError with VALIDATION_ERROR code if validation fails
 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
  query: Record<string, string | undefined>,
  requestId?: string
): z.infer<T> {
  const result = schema.safeParse(query);

  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    throw new APIError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid query parameters',
      {
        requestId,
        details: { errors },
      }
    );
  }

  return result.data;
}

/**
 * Validate path parameters against a schema
 *
 * @throws APIError with VALIDATION_ERROR code if validation fails
 */
export function validateParams<T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, string | undefined>,
  requestId?: string
): z.infer<T> {
  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    throw new APIError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid path parameters',
      {
        requestId,
        details: { errors },
      }
    );
  }

  return result.data;
}

/**
 * Create a validation middleware for request body
 */
export function bodyValidator<T extends z.ZodTypeAny>(schema: T) {
  return async (request: Request, requestId?: string): Promise<z.infer<T>> => {
    try {
      const body = await request.json();
      return validateBody(schema, body, requestId);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        ErrorCode.INVALID_INPUT,
        'Invalid JSON in request body',
        { requestId }
      );
    }
  };
}

/**
 * Sanitize string input by trimming and removing control characters
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Sanitize object strings recursively
 */
export function sanitizeStrings<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeStrings(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
