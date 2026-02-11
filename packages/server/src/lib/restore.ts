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
export function createIdMapping(): IdMapping {
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
    manifest: string;
    database?: string;
    files?: string;
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
export async function extractArchive(archivePath: string, targetDir: string): Promise<void> {
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
export function validateManifest(manifest: any): { valid: boolean; error?: string } {
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

  if (!manifest.checksums.manifest) {
    return { valid: false, error: 'Missing manifest checksum' };
  }

  return { valid: true };
}

/**
 * Import database records from backup based on restore strategy
 * Generates new IDs for all records to avoid conflicts with current user's data
 *
 * @param userId - User ID to restore data for
 * @param strategy - Restore strategy (merge, replace, skip)
 * @param records - Database records to import
 * @returns Summary of restore operation
 */
export async function importDatabaseRecords(
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
    // Create ID mapping for translating old IDs to new IDs
    const idMapping = createIdMapping();

    // Handle replace strategy: delete existing user data first
    if (strategy === 'replace') {
      await deleteUserData(userId);
      summary.warnings.push('Existing user data deleted due to replace strategy');
    }

    // Import journals FIRST (populates journal ID mapping)
    if (records.journals && records.journals.length > 0) {
      const journalResult = await importJournals(userId, strategy, records.journals, idMapping);
      summary.restored.journals = journalResult.restored;
      summary.skipped.journals = journalResult.skipped;
      summary.errors.push(...journalResult.errors);
    }

    // Import notes SECOND (populates note ID mapping)
    if (records.notes && records.notes.length > 0) {
      const notesResult = await importNotes(userId, strategy, records.notes, idMapping);
      summary.restored.notes = notesResult.restored;
      summary.skipped.notes = notesResult.skipped;
      summary.errors.push(...notesResult.errors);
    }

    // Import journal notes THIRD (uses journal and note ID mappings)
    if (records.journalNotes && records.journalNotes.length > 0) {
      const journalNotesResult = await importJournalNotes(
        userId,
        strategy,
        records.journalNotes,
        idMapping
      );
      summary.restored.journalNotes = journalNotesResult.restored;
      summary.skipped.journalNotes = journalNotesResult.skipped;
      summary.errors.push(...journalNotesResult.errors);
    }

    // Import templates
    if (records.templates && records.templates.length > 0) {
      const templatesResult = await importTemplates(userId, strategy, records.templates, idMapping);
      summary.restored.templates = templatesResult.restored;
      summary.skipped.templates = templatesResult.skipped;
      summary.errors.push(...templatesResult.errors);
    }

    // Import daily moods
    if (records.dailyMoods && records.dailyMoods.length > 0) {
      const moodsResult = await importDailyMoods(userId, strategy, records.dailyMoods, idMapping);
      summary.restored.dailyMoods = moodsResult.restored;
      summary.skipped.dailyMoods = moodsResult.skipped;
      summary.errors.push(...moodsResult.errors);
    }

    // Import transcripts (uses journal ID mapping)
    if (records.transcripts && records.transcripts.length > 0) {
      const transcriptsResult = await importTranscripts(
        userId,
        strategy,
        records.transcripts,
        idMapping
      );
      summary.restored.transcripts = transcriptsResult.restored;
      summary.skipped.transcripts = transcriptsResult.skipped;
      summary.errors.push(...transcriptsResult.errors);
    }

    // Import tags (uses journal ID mapping)
    if (records.tags && records.tags.length > 0) {
      const tagsResult = await importTags(
        userId,
        strategy,
        records.tags,
        idMapping
      );
      summary.restored.tags = tagsResult.restored;
      summary.skipped.tags = tagsResult.skipped;
      summary.errors.push(...tagsResult.errors);
    }

    // Check for critical errors
    summary.success = summary.errors.length === 0;

  } catch (error) {
    summary.success = false;
    summary.errors.push({
      table: 'general',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return summary;
}

/**
 * Resolve ID conflicts based on restore strategy
 *
 * @param strategy - Restore strategy
 * @param existingRecords - Records already in database
 * @param newRecords - Records to import
 * @returns Records to import after conflict resolution
 */
export function resolveIdConflicts<T extends { id: string }>(
  strategy: RestoreStrategy,
  existingRecords: T[],
  newRecords: T[]
): T[] {
  const existingIds = new Set(existingRecords.map((r) => r.id));

  switch (strategy) {
    case 'merge':
      // Keep existing records, only add new ones
      return newRecords.filter((record) => !existingIds.has(record.id));

    case 'replace':
      // Return all new records (existing should have been deleted)
      return newRecords;

    case 'skip':
      // Only import non-conflicting records
      return newRecords.filter((record) => !existingIds.has(record.id));

    default:
      return newRecords;
  }
}

/**
 * Restore files from backup directory to UPLOAD_DIR
 *
 * @param fileList - List of files to restore (relative paths)
 * @param targetDir - Target upload directory (UPLOAD_DIR)
 * @returns Number of files successfully restored
 */
export async function restoreFiles(fileList: string[], targetDir: string): Promise<number> {
  let restoredCount = 0;
  const errors: string[] = [];

  for (const file of fileList) {
    try {
      const sourcePath = file;
      const relativePath = file.replace(/^backup\//, ''); // Remove backup prefix if present
      const destinationPath = path.join(targetDir, relativePath);

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
 */
async function importJournals(
  userId: string,
  _strategy: RestoreStrategy,
  journals: schema.Journal[],
  idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // Always import all journals with new IDs (ignore ID conflicts in backup)
    for (const journal of journals) {
      try {
        const newId = randomUUID();
        idMapping.journals.set(journal.id, newId);

        await db.insert(schema.journals).values({
          ...journal,
          id: newId,        // Generate new ID
          userId,           // Always use current user's ID
          createdAt: journal.createdAt || new Date(),
          updatedAt: journal.updatedAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'journals',
          record: journal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'journals',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import note records with new ID generation
 */
async function importNotes(
  userId: string,
  _strategy: RestoreStrategy,
  notes: schema.Note[],
  idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // Always import all notes with new IDs
    for (const note of notes) {
      try {
        const newId = randomUUID();
        idMapping.notes.set(note.id, newId);

        await db.insert(schema.notes).values({
          ...note,
          id: newId,        // Generate new ID
          userId,           // Always use current user's ID
          createdAt: note.createdAt || new Date(),
          updatedAt: note.updatedAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'notes',
          record: note.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'notes',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import journal-note link records using ID mapping
 */
async function importJournalNotes(
  _userId: string,
  _strategy: RestoreStrategy,
  journalNotes: schema.JournalNote[],
  idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const link of journalNotes) {
      try {
        // Get the new journal ID and note ID from the mapping
        const newJournalId = idMapping.journals.get(link.journalId);
        const newNoteId = idMapping.notes.get(link.noteId);

        // Skip if either the journal or note wasn't imported
        if (!newJournalId || !newNoteId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();

        await db.insert(schema.journalNotes).values({
          id: newId,
          journalId: newJournalId,  // Use new journal ID
          noteId: newNoteId,         // Use new note ID
          createdAt: link.createdAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'journal_notes',
          record: link.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'journal_notes',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import template records with new ID generation
 */
async function importTemplates(
  userId: string,
  _strategy: RestoreStrategy,
  templates: schema.Template[],
  _idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // Always import all templates with new IDs
    for (const template of templates) {
      try {
        const newId = randomUUID();

        await db.insert(schema.templates).values({
          ...template,
          id: newId,        // Generate new ID
          userId,           // Always use current user's ID
          createdAt: template.createdAt || new Date(),
          updatedAt: template.updatedAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'templates',
          record: template.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'templates',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import daily mood records with new ID generation
 */
async function importDailyMoods(
  userId: string,
  _strategy: RestoreStrategy,
  dailyMoods: schema.DailyMood[],
  _idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    // Always import all daily moods with new IDs
    for (const mood of dailyMoods) {
      try {
        const newId = randomUUID();

        await db.insert(schema.dailyMoods).values({
          ...mood,
          id: newId,        // Generate new ID
          userId,           // Always use current user's ID
          createdAt: mood.createdAt || new Date(),
          updatedAt: mood.updatedAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'daily_moods',
          record: mood.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'daily_moods',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import transcript records using ID mapping
 */
async function importTranscripts(
  _userId: string,
  _strategy: RestoreStrategy,
  transcripts: schema.Transcript[],
  idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const transcript of transcripts) {
      try {
        // Get the new journal ID from the mapping
        const newJournalId = idMapping.journals.get(transcript.journalId);

        // Skip if the journal wasn't imported
        if (!newJournalId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();
        idMapping.transcripts.set(transcript.id, newId);

        await db.insert(schema.transcripts).values({
          ...transcript,
          id: newId,
          journalId: newJournalId,  // Use new journal ID
          createdAt: transcript.createdAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'transcripts',
          record: transcript.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'transcripts',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Import tag records using ID mapping
 */
async function importTags(
  _userId: string,
  _strategy: RestoreStrategy,
  tags: schema.Tag[],
  idMapping: IdMapping
): Promise<{ restored: number; skipped: number; errors: Array<{ table: string; record: string; error: string }> }> {
  const result = { restored: 0, skipped: 0, errors: [] as Array<{ table: string; record: string; error: string }> };

  try {
    for (const tag of tags) {
      try {
        // Get the new journal ID from the mapping
        const newJournalId = idMapping.journals.get(tag.journalId);

        // Skip if the journal wasn't imported
        if (!newJournalId) {
          result.skipped++;
          continue;
        }

        const newId = randomUUID();
        idMapping.tags.set(tag.id, newId);

        await db.insert(schema.tags).values({
          ...tag,
          id: newId,
          journalId: newJournalId,  // Use new journal ID
          createdAt: tag.createdAt || new Date(),
        });
        result.restored++;
      } catch (error) {
        result.errors.push({
          table: 'tags',
          record: tag.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    result.errors.push({
      table: 'tags',
      record: 'N/A',
      error: error instanceof Error ? error.message : String(error),
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

  // Create temp directory for extraction
  const tempDir = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'restore-temp', userId);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Extract archive
    await extractArchive(archivePath, tempDir);

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

      // Restore files
      const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
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
