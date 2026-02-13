/**
 * Restore Library
 *
 * Core functionality for restoring user data from backup archives.
 * Handles archive extraction, manifest validation, database record import,
 * file restoration, and ID remapping for new user instances.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import * as tarFs from 'tar-fs';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import {
  safeResolveDatabasePath,
  validatePathWithinDir,
  getValidatedUploadDir,
  sanitizeFilename,
} from './path-security.js';
import { withTransaction } from './db-utils.js';

/**
 * ID mapping for restoring data with new IDs
 * Maps old IDs from backup to new IDs for current user
 */
export interface IdMapping {
  journals: Map<string, string>;      // old journal ID -> new journal ID
  notes: Map<string, string>;         // old note ID -> new note ID
  transcripts: Map<string, string>;   // old transcript ID -> new transcript ID
  tags: Map<string, string>;          // old tag ID -> new tag ID
  journalNotes: Map<string, string>;  // old journalNote ID -> new journalNote ID
}

/**
 * Create a new ID mapping
 */
function createIdMapping(): IdMapping {
  return {
    journals: new Map(),
    notes: new Map(),
    transcripts: new Map(),
    tags: new Map(),
    journalNotes: new Map(),
  };
}

/**
 * Restore strategy for handling conflicts
 */
export type RestoreStrategy = 'merge' | 'replace' | 'skip';

/**
 * Backup manifest structure
 */
export interface BackupManifest {
  version: string;
  timestamp: string;
  userId: string;
  checksums: {
    [filename: string]: string;
  };
  stats?: {
    journals: number;
    notes: number;
    templates: number;
    dailyMoods: number;
    files: number;
  };
}

/**
 * Database records from backup
 */
export interface DatabaseRecords {
  journals?: Array<schema.Journal>;
  notes?: Array<schema.Note>;
  journalNotes?: Array<schema.JournalNote>;
  templates?: Array<schema.Template>;
  dailyMoods?: Array<schema.DailyMood>;
  transcripts?: Array<schema.Transcript>;
  tags?: Array<schema.Tag>;
}

/**
 * Restore operation summary
 */
export interface RestoreSummary {
  success: boolean;
  restored: {
    journals: number;
    notes: number;
    journalNotes: number;
    templates: number;
    dailyMoods: number;
    transcripts: number;
    tags: number;
    files: number;
  };
  skipped: {
    journals: number;
    notes: number;
    journalNotes: number;
    templates: number;
    dailyMoods: number;
    transcripts: number;
    tags: number;
  };
  errors: Array<{
    table: string;
    record: string;
    error: string;
  }>;
  warnings: string[];
}

/**
 * Extract a tar.gz archive to a target directory
 *
 * @param archivePath - Path to the tar.gz archive
 * @param targetDir - Directory to extract files to
 * @throws Error if extraction fails
 */
async function extractArchive(archivePath: string, targetDir: string): Promise<void> {
  try {
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Extract tar.gz archive
    const readStream = createReadStream(archivePath);
    const gunzip = createGunzip();
    const writeStream = tarFs.extract(targetDir, {
      strip: 0, // Don't strip any path components
    });

    await pipeline(readStream, gunzip, writeStream);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract archive: ${message}`);
  }
}

/**
 * Validate backup manifest structure and required fields
 *
 * @param manifest - Parsed manifest object
 * @returns Validation result with error message if invalid
 */
function validateManifest(manifest: any): { valid: boolean; error?: string } {
  // Check if manifest exists
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: 'Manifest is missing or invalid' };
  }

  // Check required fields
  const requiredFields = ['version', 'timestamp', 'userId', 'checksums'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate version format (should be semantic version)
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!versionRegex.test(manifest.version)) {
    return { valid: false, error: `Invalid version format: ${manifest.version}` };
  }

  // Validate timestamp (ISO 8601 format)
  const timestamp = new Date(manifest.timestamp);
  if (isNaN(timestamp.getTime())) {
    return { valid: false, error: `Invalid timestamp format: ${manifest.timestamp}` };
  }

  // Validate userId (UUID format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(manifest.userId)) {
    return { valid: false, error: `Invalid userId format: ${manifest.userId}` };
  }

  // Validate checksums object
  if (!manifest.checksums || typeof manifest.checksums !== 'object') {
    return { valid: false, error: 'Missing or invalid checksums object' };
  }

  return { valid: true };
}

/**
 * Import database records from backup based on restore strategy
 * Generates new IDs for all records to avoid conflicts with current user's data
 *
 * Uses a transaction to ensure atomicity of the restore operation.
 * If any part of the restore fails, all changes are rolled back.
 *
 * @param userId - User ID to restore data for
 * @param strategy - Restore strategy (merge, replace, skip)
 * @param records - Database records to import
 * @returns Summary of restore operation
 */
async function importDatabaseRecords(
  userId: string,
  strategy: RestoreStrategy,
  records: DatabaseRecords
): Promise<RestoreSummary> {
  const summary: RestoreSummary = {
    success: true,
    restored: {
      journals: 0,
      notes: 0,
      journalNotes: 0,
      templates: 0,
      dailyMoods: 0,
      transcripts: 0,
      tags: 0,
      files: 0,
    },
    skipped: {
      journals: 0,
      notes: 0,
      journalNotes: 0,
      templates: 0,
      dailyMoods: 0,
      transcripts: 0,
      tags: 0,
    },
    errors: [],
    warnings: [],
  };

  try {
    // Execute the entire restore operation in a transaction
    await withTransaction(async (tx) => {
      // Create ID mapping for translating old IDs to new IDs
      const idMapping = createIdMapping();

      // Handle replace strategy: delete existing user data first
      if (strategy === 'replace') {
        await deleteUserDataWithTx(userId, tx);
        summary.warnings.push('Existing user data deleted due to replace strategy');
      }

      // Import journals FIRST (populates journal ID mapping)
      if (records.journals && records.journals.length > 0) {
        const journalResult = await importJournalsWithTx(userId, strategy, records.journals, idMapping, tx);
        summary.restored.journals = journalResult.restored;
        summary.skipped.journals = journalResult.skipped;
        summary.errors.push(...journalResult.errors);
      }

      // Import notes SECOND (populates note ID mapping)
      if (records.notes && records.notes.length > 0) {
        const notesResult = await importNotesWithTx(userId, strategy, records.notes, idMapping, tx);
        summary.restored.notes = notesResult.restored;
        summary.skipped.notes = notesResult.skipped;
        summary.errors.push(...notesResult.errors);
      }

      // Import journal notes THIRD (uses journal and note ID mappings)
      if (records.journalNotes && records.journalNotes.length > 0) {
        const journalNotesResult = await importJournalNotesWithTx(
          userId,
          strategy,
          records.journalNotes,
          idMapping,
          tx
        );
        summary.restored.journalNotes = journalNotesResult.restored;
        summary.skipped.journalNotes = journalNotesResult.skipped;
        summary.errors.push(...journalNotesResult.errors);
      }

      // Import templates
      if (records.templates && records.templates.length > 0) {
        const templatesResult = await importTemplatesWithTx(userId, strategy, records.templates, idMapping, tx);
        summary.restored.templates = templatesResult.restored;
        summary.skipped.templates = templatesResult.skipped;
        summary.errors.push(...templatesResult.errors);
      }

      // Import daily moods
      if (records.dailyMoods && records.dailyMoods.length > 0) {
        const moodsResult = await importDailyMoodsWithTx(userId, strategy, records.dailyMoods, idMapping, tx);
        summary.restored.dailyMoods = moodsResult.restored;
        summary.skipped.dailyMoods = moodsResult.skipped;
        summary.errors.push(...moodsResult.errors);
      }

      // Import transcripts (uses journal ID mapping)
      if (records.transcripts && records.transcripts.length > 0) {
        const transcriptsResult = await importTranscriptsWithTx(
          userId,
          strategy,
          records.transcripts,
          idMapping,
          tx
        );
        summary.restored.transcripts = transcriptsResult.restored;
        summary.skipped.transcripts = transcriptsResult.skipped;
        summary.errors.push(...transcriptsResult.errors);
      }

      // Import tags (uses journal ID mapping)
      if (records.tags && records.tags.length > 0) {
        const tagsResult = await importTagsWithTx(
          userId,
          strategy,
          records.tags,
          idMapping,
          tx
        );
        summary.restored.tags = tagsResult.restored;
        summary.skipped.tags = tagsResult.skipped;
        summary.errors.push(...tagsResult.errors);
      }
    });

    // Check for critical errors
    summary.success = summary.errors.length === 0;

  } catch (error) {
    summary.success = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Transaction failed:', errorMsg);
    summary.errors.push({
      table: 'general',
      record: 'N/A',
      error: errorMsg,
    });
  }

  // Log summary of import results
  console.log(`[Restore] Import summary:
  - Journals: ${summary.restored.journals} restored, ${summary.skipped.journals} skipped
  - Notes: ${summary.restored.notes} restored, ${summary.skipped.notes} skipped
  - JournalNotes: ${summary.restored.journalNotes} restored, ${summary.skipped.journalNotes} skipped
  - Templates: ${summary.restored.templates} restored, ${summary.skipped.templates} skipped
  - DailyMoods: ${summary.restored.dailyMoods} restored, ${summary.skipped.dailyMoods} skipped
  - Transcripts: ${summary.restored.transcripts} restored, ${summary.skipped.transcripts} skipped
  - Tags: ${summary.restored.tags} restored, ${summary.skipped.tags} skipped
  - Errors: ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.error('[Restore] Import errors:', summary.errors);
  }

  return summary;
}

/**
 * Restore files from backup directory to UPLOAD_DIR
 *
 * Uses safe path resolution to prevent path traversal attacks.
 *
 * @param fileList - List of files to restore (relative paths)
 * @param targetDir - Target upload directory (UPLOAD_DIR)
 * @returns Number of files successfully restored
 */
async function restoreFiles(fileList: string[], targetDir: string): Promise<number> {
  let restoredCount = 0;
  const errors: string[] = [];

  // Validate the target directory
  const validatedTargetDir = getValidatedUploadDir();

  // Ensure targetDir matches validated upload dir or is within it
  try {
    validatePathWithinDir(targetDir, validatedTargetDir);
  } catch {
    console.error('[Restore] Invalid target directory:', targetDir);
    return 0;
  }

  for (const file of fileList) {
    try {
      const sourcePath = file;
      // Remove backup prefix if present and sanitize
      const relativePath = file.replace(/^backup\//, '');

      // Validate and sanitize the destination path
      const pathResult = safeResolveDatabasePath(relativePath, targetDir);

      if (!pathResult.safe || !pathResult.path) {
        console.warn(`[Restore] Blocked unsafe restore path: ${relativePath}`);
        errors.push(`${file}: ${pathResult.safe ? 'Unknown error' : pathResult.error}`);
        continue;
      }

      const destinationPath = pathResult.path;

      // Ensure destination directory exists
      const destDir = path.dirname(destinationPath);
      await fs.mkdir(destDir, { recursive: true });

      // Copy file
      await fs.copyFile(sourcePath, destinationPath);
      restoredCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${message}`);
    }
  }

  if (errors.length > 0) {
    console.warn('[Restore] File restore errors:', errors);
  }

  return restoredCount;
}

/**
 * Delete all user data (for replace strategy)
 * Transaction-aware version
 */
async function deleteUserDataWithTx(userId: string, tx: any): Promise<void> {
  // Get IDs of records to delete
  const tagIds = await tx
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .innerJoin(schema.journals, eq(schema.tags.journalId, schema.journals.id))
    .where(eq(schema.journals.userId, userId));

  const transcriptIds = await tx
    .select({ id: schema.transcripts.id })
    .from(schema.transcripts)
    .innerJoin(schema.journals, eq(schema.transcripts.journalId, schema.journals.id))
    .where(eq(schema.journals.userId, userId));

  const journalNoteIds = await tx
    .select({ id: schema.journalNotes.id })
    .from(schema.journalNotes)
    .innerJoin(schema.notes, eq(schema.journalNotes.noteId, schema.notes.id))
    .where(eq(schema.notes.userId, userId));

  // Delete in order of dependencies to avoid foreign key violations
  if (tagIds.length > 0) {
    await tx.delete(schema.tags).where(inArray(schema.tags.id, tagIds.map((t: { id: string }) => t.id)));
  }

  if (transcriptIds.length > 0) {
    await tx.delete(schema.transcripts).where(inArray(schema.transcripts.id, transcriptIds.map((t: { id: string }) => t.id)));
  }

  if (journalNoteIds.length > 0) {
    await tx.delete(schema.journalNotes).where(inArray(schema.journalNotes.id, journalNoteIds.map((j: { id: string }) => j.id)));
  }

  await tx.delete(schema.notes).where(eq(schema.notes.userId, userId));
  await tx.delete(schema.journals).where(eq(schema.journals.userId, userId));
  await tx.delete(schema.templates).where(eq(schema.templates.userId, userId));
  await tx.delete(schema.dailyMoods).where(eq(schema.dailyMoods.userId, userId));
}

/**
 * Delete all user data (for replace strategy)
 * @deprecated Use deleteUserDataWithTx instead
 */
async function deleteUserData(userId: string): Promise<void> {
  // Get IDs of records to delete
  const tagIds = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .innerJoin(schema.journals, eq(schema.tags.journalId, schema.journals.id))
    .where(eq(schema.journals.userId, userId));

  const transcriptIds = await db
    .select({ id: schema.transcripts.id })
    .from(schema.transcripts)
    .innerJoin(schema.journals, eq(schema.transcripts.journalId, schema.journals.id))
    .where(eq(schema.journals.userId, userId));

  const journalNoteIds = await db
    .select({ id: schema.journalNotes.id })
    .from(schema.journalNotes)
    .innerJoin(schema.notes, eq(schema.journalNotes.noteId, schema.notes.id))
    .where(eq(schema.notes.userId, userId));

  // Delete in order of dependencies to avoid foreign key violations
  if (tagIds.length > 0) {
    await db.delete(schema.tags).where(inArray(schema.tags.id, tagIds.map((t) => t.id)));
  }

  if (transcriptIds.length > 0) {
    await db.delete(schema.transcripts).where(inArray(schema.transcripts.id, transcriptIds.map((t) => t.id)));
  }

  if (journalNoteIds.length > 0) {
    await db.delete(schema.journalNotes).where(inArray(schema.journalNotes.id, journalNoteIds.map((j) => j.id)));
  }

  await db.delete(schema.notes).where(eq(schema.notes.userId, userId));
  await db.delete(schema.journals).where(eq(schema.journals.userId, userId));
  await db.delete(schema.templates).where(eq(schema.templates.userId, userId));
  await db.delete(schema.dailyMoods).where(eq(schema.dailyMoods.userId, userId));
}

/**
 * Import journal records with new ID generation
 * Transaction-aware version
 */
async function importJournalsWithTx(
  userId: string,
  _strategy: RestoreStrategy,
  journals: schema.Journal[],
  idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // Always import all journals with new IDs (ignore ID conflicts in backup)
    for (const journal of journals) {
      try {
        const newId = randomUUID();
        idMapping.journals.set(journal.id, newId);

        await tx.insert(schema.journals).values({
          id: newId,
          userId,
          title: journal.title,
          videoPath: journal.videoPath,
          thumbnailPath: journal.thumbnailPath,
          duration: journal.duration,
          location: journal.location,
          notes: journal.notes,
          manualMood: journal.manualMood,
          dominantEmotion: journal.dominantEmotion,
          emotionTimeline: journal.emotionTimeline,
          emotionScores: journal.emotionScores,
          hlsManifestPath: journal.hlsManifestPath,
          hlsStatus: journal.hlsStatus,
          hlsError: journal.hlsError,
          hlsCreatedAt: journal.hlsCreatedAt
            ? (typeof journal.hlsCreatedAt === 'string' ? new Date(journal.hlsCreatedAt) : journal.hlsCreatedAt)
            : null,
          createdAt: typeof journal.createdAt === 'string' ? new Date(journal.createdAt) : (journal.createdAt || new Date()),
          updatedAt: typeof journal.updatedAt === 'string' ? new Date(journal.updatedAt) : (journal.updatedAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import journal ${journal.id}:`, errorMsg);
        result.errors.push({
          table: 'journals',
          record: journal.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Journal import failed:', errorMsg);
    result.errors.push({
      table: 'journals',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

/**
 * Progress callback type for restore operations
 */
export interface RestoreProgress {
  step: string;
  stepIndex: number;
  percentage: number;
}

/**
 * Restore backup summary for queue
 */
export interface QueueRestoreSummary {
  journalsRestored: number;
  notesRestored: number;
  filesRestored: number;
  conflictsResolved: number;
}

/**
 * Main restore function that orchestrates the entire restore process
 *
 * @param userId - The user ID to restore data for
 * @param archivePath - Path to the tar.gz backup archive
 * @param strategy - Restore strategy (merge, replace, skip)
 * @param onProgress - Optional callback for progress updates
 * @returns Promise containing restore summary
 */
export async function restoreBackup(
  userId: string,
  archivePath: string,
  strategy: RestoreStrategy,
  onProgress?: (progress: RestoreProgress) => void
): Promise<QueueRestoreSummary> {
  const updateProgress = (step: string, index: number, percentage: number) => {
    if (onProgress) {
      onProgress({ step, stepIndex: index, percentage });
    }
  };

  updateProgress('Extracting archive', 1, 10);

  // Use validated upload directory
  const uploadDir = getValidatedUploadDir();

  // Create temp directory for extraction with sanitized user ID
  const sanitizedUserId = sanitizeFilename(userId);
  const tempDir = path.join(uploadDir, 'restore-temp', sanitizedUserId);

  // Validate archive path is within expected location
  const archivePathResult = safeResolveDatabasePath(archivePath, uploadDir);
  if (!archivePathResult.safe || !archivePathResult.path) {
    throw new Error(`Invalid archive path: ${archivePathResult.safe ? 'Unknown error' : archivePathResult.error}`);
  }

  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Extract archive
    await extractArchive(archivePathResult.path, tempDir);

    updateProgress('Reading backup data', 2, 20);

    // Read manifest
    const manifestPath = path.join(tempDir, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: BackupManifest = JSON.parse(manifestContent);

    // Validate manifest
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid backup manifest: ${validation.error}`);
    }

    // Read database files
    updateProgress('Loading database records', 3, 30);

    const databaseDir = path.join(tempDir, 'database');
    const records: DatabaseRecords = {};

    try {
      const journalsContent = await fs.readFile(path.join(databaseDir, 'journals.json'), 'utf-8');
      records.journals = JSON.parse(journalsContent);
    } catch {
      // File may not exist
    }

    try {
      const notesContent = await fs.readFile(path.join(databaseDir, 'notes.json'), 'utf-8');
      records.notes = JSON.parse(notesContent);
    } catch {
      // File may not exist
    }

    try {
      const journalNotesContent = await fs.readFile(path.join(databaseDir, 'journalNotes.json'), 'utf-8');
      records.journalNotes = JSON.parse(journalNotesContent);
    } catch {
      // File may not exist
    }

    try {
      const templatesContent = await fs.readFile(path.join(databaseDir, 'templates.json'), 'utf-8');
      records.templates = JSON.parse(templatesContent);
    } catch {
      // File may not exist
    }

    try {
      const dailyMoodsContent = await fs.readFile(path.join(databaseDir, 'dailyMoods.json'), 'utf-8');
      records.dailyMoods = JSON.parse(dailyMoodsContent);
    } catch {
      // File may not exist
    }

    try {
      const transcriptsContent = await fs.readFile(path.join(databaseDir, 'transcripts.json'), 'utf-8');
      records.transcripts = JSON.parse(transcriptsContent);
    } catch {
      // File may not exist
    }

    try {
      const tagsContent = await fs.readFile(path.join(databaseDir, 'tags.json'), 'utf-8');
      records.tags = JSON.parse(tagsContent);
    } catch {
      // File may not exist
    }

    // Delete existing data if replace strategy
    if (strategy === 'replace') {
      updateProgress('Deleting existing data', 4, 40);
      await deleteUserData(userId);
    }

    // Import database records
    updateProgress('Importing database records', 5, 60);
    const dbResult = await importDatabaseRecords(userId, strategy, records);

    // Restore files
    updateProgress('Restoring files', 6, 80);

    const filesDir = path.join(tempDir, 'files');
    let filesRestored = 0;

    try {
      // Collect all files to restore
      const filesToRestore: string[] = [];

      const collectFiles = async (dir: string, baseDir: string) => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              await collectFiles(path.join(dir, entry.name), baseDir);
            } else if (entry.isFile()) {
              filesToRestore.push(path.join(dir, entry.name));
            }
          }
        } catch {
          // Directory may not exist
        }
      };

      await collectFiles(filesDir, filesDir);

      // Restore files to validated upload directory
      filesRestored = await restoreFiles(filesToRestore, uploadDir);
    } catch {
      // Files directory may not exist
    }

    updateProgress('Restore completed', 7, 100);

    // Calculate conflicts resolved
    const conflictsResolved = dbResult.skipped.journals + dbResult.skipped.notes;

    return {
      journalsRestored: dbResult.restored.journals,
      notesRestored: dbResult.restored.notes,
      filesRestored,
      conflictsResolved,
    };
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Transaction-aware versions of import functions

async function importNotesWithTx(
  userId: string,
  _strategy: RestoreStrategy,
  notes: schema.Note[],
  idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // First pass: Generate all new IDs and populate the mapping
    // This is needed because notes can have parent-child relationships
    const noteIdMap = new Map<string, string>();
    for (const note of notes) {
      const newId = randomUUID();
      noteIdMap.set(note.id, newId);
      idMapping.notes.set(note.id, newId);
    }

    // Second pass: Insert all notes with mapped parentIds
    for (const note of notes) {
      try {
        const newId = noteIdMap.get(note.id)!;

        // Convert deletedAt timestamp if present
        let deletedAt: Date | null = null;
        if (note.deletedAt) {
          deletedAt = typeof note.deletedAt === 'string' ? new Date(note.deletedAt) : note.deletedAt;
        }

        // Map parentId to new ID if present
        let parentId: string | null = null;
        if (note.parentId) {
          const mappedParentId = noteIdMap.get(note.parentId);
          if (mappedParentId) {
            parentId = mappedParentId;
          } else {
            // Parent doesn't exist in backup, skip this reference
            console.warn(`[Restore] Note ${note.id} references non-existent parent ${note.parentId}, setting parentId to null`);
          }
        }

        await tx.insert(schema.notes).values({
          id: newId,
          userId,
          title: note.title,
          content: note.content,
          icon: note.icon,
          color: note.color,
          parentId,
          position: note.position,
          deletedAt,
          createdAt: typeof note.createdAt === 'string' ? new Date(note.createdAt) : (note.createdAt || new Date()),
          updatedAt: typeof note.updatedAt === 'string' ? new Date(note.updatedAt) : (note.updatedAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import note ${note.id}:`, errorMsg);
        result.errors.push({
          table: 'notes',
          record: note.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Note import failed:', errorMsg);
    result.errors.push({
      table: 'notes',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

async function importJournalNotesWithTx(
  _userId: string,
  _strategy: RestoreStrategy,
  journalNotes: schema.JournalNote[],
  idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const link of journalNotes) {
      try {
        const newJournalId = idMapping.journals.get(link.journalId);
        const newNoteId = idMapping.notes.get(link.noteId);

        if (!newJournalId || !newNoteId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();

        await tx.insert(schema.journalNotes).values({
          id: newId,
          journalId: newJournalId,
          noteId: newNoteId,
          createdAt: typeof link.createdAt === 'string' ? new Date(link.createdAt) : (link.createdAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import journalNote ${link.id}:`, errorMsg);
        result.errors.push({
          table: 'journal_notes',
          record: link.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] JournalNote import failed:', errorMsg);
    result.errors.push({
      table: 'journal_notes',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

async function importTemplatesWithTx(
  userId: string,
  _strategy: RestoreStrategy,
  templates: schema.Template[],
  _idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const template of templates) {
      try {
        const newId = randomUUID();

        await tx.insert(schema.templates).values({
          id: newId,
          userId,
          title: template.title,
          content: template.content,
          icon: template.icon,
          color: template.color,
          createdAt: typeof template.createdAt === 'string' ? new Date(template.createdAt) : (template.createdAt || new Date()),
          updatedAt: typeof template.updatedAt === 'string' ? new Date(template.updatedAt) : (template.updatedAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import template ${template.id}:`, errorMsg);
        result.errors.push({
          table: 'templates',
          record: template.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Template import failed:', errorMsg);
    result.errors.push({
      table: 'templates',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

async function importDailyMoodsWithTx(
  userId: string,
  _strategy: RestoreStrategy,
  dailyMoods: schema.DailyMood[],
  _idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const mood of dailyMoods) {
      try {
        const newId = randomUUID();

        await tx.insert(schema.dailyMoods).values({
          id: newId,
          userId,
          date: mood.date, // PostgreSQL DATE column accepts 'YYYY-MM-DD' string format
          mood: mood.mood,
          timeOfDay: mood.timeOfDay,
          notes: mood.notes,
          createdAt: typeof mood.createdAt === 'string' ? new Date(mood.createdAt) : (mood.createdAt || new Date()),
          updatedAt: typeof mood.updatedAt === 'string' ? new Date(mood.updatedAt) : (mood.updatedAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import dailyMood ${mood.id}:`, errorMsg);
        result.errors.push({
          table: 'daily_moods',
          record: mood.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] DailyMood import failed:', errorMsg);
    result.errors.push({
      table: 'daily_moods',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

async function importTranscriptsWithTx(
  _userId: string,
  _strategy: RestoreStrategy,
  transcripts: schema.Transcript[],
  idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const transcript of transcripts) {
      try {
        const newJournalId = idMapping.journals.get(transcript.journalId);

        if (!newJournalId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();
        idMapping.transcripts.set(transcript.id, newId);

        await tx.insert(schema.transcripts).values({
          id: newId,
          journalId: newJournalId,
          text: transcript.text,
          segments: transcript.segments,
          createdAt: typeof transcript.createdAt === 'string' ? new Date(transcript.createdAt) : (transcript.createdAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import transcript ${transcript.id}:`, errorMsg);
        result.errors.push({
          table: 'transcripts',
          record: transcript.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Transcript import failed:', errorMsg);
    result.errors.push({
      table: 'transcripts',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}

async function importTagsWithTx(
  _userId: string,
  _strategy: RestoreStrategy,
  tags: schema.Tag[],
  idMapping: IdMapping,
  tx: any
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const tag of tags) {
      try {
        const newJournalId = idMapping.journals.get(tag.journalId);

        if (!newJournalId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();
        idMapping.tags.set(tag.id, newId);

        await tx.insert(schema.tags).values({
          id: newId,
          journalId: newJournalId,
          tag: tag.tag,
          createdAt: typeof tag.createdAt === 'string' ? new Date(tag.createdAt) : (tag.createdAt || new Date()),
        });
        result.restored++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Restore] Failed to import tag ${tag.id}:`, errorMsg);
        result.errors.push({
          table: 'tags',
          record: tag.id,
          error: errorMsg,
        });
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Restore] Tag import failed:', errorMsg);
    result.errors.push({
      table: 'tags',
      record: 'N/A',
      error: errorMsg,
    });
  }

  return result;
}
