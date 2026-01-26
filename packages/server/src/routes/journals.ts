/**
 * Journal streaming API routes
 *
 * Handles video streaming endpoints for journal creation:
 * - POST /api/journals/stream/init - Initialize a new stream
 * - POST /api/journals/stream - Upload stream data
 */

import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { journals } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq, desc, gte, lte, or, ilike, and, sql } from 'drizzle-orm';
import { generateThumbnailForVideo } from '../lib/thumbnail.js';