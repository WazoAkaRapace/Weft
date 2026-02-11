/**
 * Backup and Restore Library
 *
 * Provides functionality to export user data and create backup archives.
 *
 * Archive structure:
 * weft-backup-{timestamp}-{userId}.tar.gz
 * ├── manifest.json
 * ├── database/
 * │   ├── journals.json
 * │   ├── notes.json
 * │   ├── journalNotes.json
 * │   ├── templates.json
 * │   ├── dailyMoods.json
 * │   ├── transcripts.json
 * │   └── tags.json
 * └── files/
 *     ├── videos/
 *     ├── thumbnails/
 *     └── hls/
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  journals,
  notes,
  journalNotes,
  templates,
  dailyMoods,
  transcripts,
  tags,
} from '../db/schema.js';
import archiver from 'archiver';
import { createHash } from 'crypto';
import { readdir, readFile, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import { finished } from 'node:stream/promises';

/**
 * Directory where uploaded files are stored
 * Defaults to /app/uploads in production
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

/**
 * Directory where backup archives are stored
 */
const BACKUP_DIR = process.env.BACKUP_DIR || join(UPLOAD_DIR, 'backups');

/**
 * Progress callback for backup operations
 */
export interface BackupProgressCallback {
  (progress: {
    step: string;
    stepIndex: number;
    percentage: number;
  }): void;
}

/**
 * Metadata for backup manifest
 */
export interface BackupMetadata {
  version: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  username?: string;
  checksums: {
    [filename: string]: string;
  };
}

/**
 * Result of user data export
 */
export interface UserDataExport {
  user: {
    id: string;
    username?: string;
    email?: string;
    name?: string;
    preferredLanguage: string;
    transcriptionModel: string;
    createdAt: Date;
  };
  journals: unknown[];
  notes: unknown[];
  journalNotes: unknown[];
  templates: unknown[];
  dailyMoods: unknown[];
  transcripts: unknown[];
  tags: unknown[];
}

/**
 * File reference for backup
 */
export interface FileReference {
  type: 'video' | 'thumbnail' | 'hls';
  path: string;
  archivePath: string;
  size?: number;
}

/**
 * Exports all user data from the database
 *
 * @param userId - The user ID to export data for
 * @returns Promise containing all user data as JSON objects
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  // Get user information
  const userResult = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      preferredLanguage: users.preferredLanguage,
      transcriptionModel: users.transcriptionModel,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }

  const user = userResult[0];

  // Query all related data in parallel for efficiency
  const [journalsResult, notesResult, journalNotesResult, templatesResult, dailyMoodsResult, transcriptsResult, tagsResult] =
    await Promise.all([
      // Get all journals for user
      db.select().from(journals).where(eq(journals.userId, userId)),
      // Get all notes (including soft deleted for complete backup)
      db.select().from(notes).where(eq(notes.userId, userId)),
      // Get all journal notes junction records
      db
        .select({
          id: journalNotes.id,
          noteId: journalNotes.noteId,
          journalId: journalNotes.journalId,
          createdAt: journalNotes.createdAt,
        })
        .from(journalNotes)
        .innerJoin(journals, eq(journalNotes.journalId, journals.id))
        .where(eq(journals.userId, userId)),
      // Get all templates for user
      db.select().from(templates).where(eq(templates.userId, userId)),
      // Get all daily moods for user
      db.select().from(dailyMoods).where(eq(dailyMoods.userId, userId)),
      // Get all transcripts for user's journals
      db
        .select({
          id: transcripts.id,
          journalId: transcripts.journalId,
          text: transcripts.text,
          segments: transcripts.segments,
          createdAt: transcripts.createdAt,
        })
        .from(transcripts)
        .innerJoin(journals, eq(transcripts.journalId, journals.id))
        .where(eq(journals.userId, userId)),
      // Get all tags for user's journals
      db
        .select({
          id: tags.id,
          journalId: tags.journalId,
          tag: tags.tag,
          createdAt: tags.createdAt,
        })
        .from(tags)
        .innerJoin(journals, eq(tags.journalId, journals.id))
        .where(eq(journals.userId, userId)),
    ]);

  return {
    user: {
      id: user.id,
      username: user.username || undefined,
      email: user.email || undefined,
      name: user.name || undefined,
      preferredLanguage: user.preferredLanguage || 'en',
      transcriptionModel: user.transcriptionModel || 'Xenova/whisper-small',
      createdAt: user.createdAt,
    },
    journals: journalsResult,
    notes: notesResult,
    journalNotes: journalNotesResult,
    templates: templatesResult,
    dailyMoods: dailyMoodsResult,
    transcripts: transcriptsResult,
    tags: tagsResult,
  };
}

/**
 * Scans database records to build a list of all files that need to be backed up
 *
 * @param userId - The user ID to collect files for
 * @returns Promise containing array of file references
 */
export async function collectFiles(userId: string): Promise<FileReference[]> {
  const files: FileReference[] = [];

  console.log(`[Backup] Collecting files for user ${userId} from UPLOAD_DIR=${UPLOAD_DIR}`);

  // Get journals to find video and thumbnail paths
  const journalsResult = await db
    .select({
      videoPath: journals.videoPath,
      thumbnailPath: journals.thumbnailPath,
      hlsManifestPath: journals.hlsManifestPath,
      hlsStatus: journals.hlsStatus,
    })
    .from(journals)
    .where(eq(journals.userId, userId));

  for (const journal of journalsResult) {
    // Add video file
    if (journal.videoPath) {
      // Handle both relative and absolute paths
      const fullPath = journal.videoPath.startsWith('/')
        ? journal.videoPath
        : join(UPLOAD_DIR, journal.videoPath);
      try {
        const fileStat = await stat(fullPath);
        files.push({
          type: 'video',
          path: fullPath,
          archivePath: join('files', 'videos', journal.videoPath),
          size: fileStat.size,
        });
      } catch {
        // File may not exist, skip it
        console.warn(`[Backup] Video file not found: ${fullPath}`);
      }
    }

    // Add thumbnail file
    if (journal.thumbnailPath) {
      // Handle both relative and absolute paths
      const fullPath = journal.thumbnailPath.startsWith('/')
        ? journal.thumbnailPath
        : join(UPLOAD_DIR, journal.thumbnailPath);
      try {
        const fileStat = await stat(fullPath);
        files.push({
          type: 'thumbnail',
          path: fullPath,
          archivePath: join('files', 'thumbnails', journal.thumbnailPath),
          size: fileStat.size,
        });
      } catch {
        // File may not exist, skip it
        console.warn(`[Backup] Thumbnail file not found: ${fullPath}`);
      }
    }

    // Add HLS directory if transcoding completed
    if (
      journal.hlsManifestPath &&
      journal.hlsStatus === 'completed'
    ) {
      // Handle both relative and absolute paths
      const manifestPathForDir = journal.hlsManifestPath.replace('/master.m3u8', '');
      const hlsDir = manifestPathForDir.startsWith('/')
        ? manifestPathForDir
        : join(UPLOAD_DIR, manifestPathForDir);
      try {
        const hlsFiles = await readdir(hlsDir);
        for (const hlsFile of hlsFiles) {
          const fullPath = join(hlsDir, hlsFile);
          try {
            const fileStat = await stat(fullPath);
            if (fileStat.isFile()) {
              files.push({
                type: 'hls',
                path: fullPath,
                archivePath: join('files', 'hls', journal.hlsManifestPath.replace('/master.m3u8', ''), hlsFile),
                size: fileStat.size,
              });
            }
          } catch {
            // Skip files that can't be accessed
          }
        }
      } catch (err) {
        // HLS directory may not exist, skip it
        console.warn(`[Backup] HLS directory not found or error: ${hlsDir}`, err);
      }
    }
  }

  console.log(`[Backup] Collected ${files.length} files for backup`);
  return files;
}

/**
 * Generates a manifest file for the backup archive
 *
 * @param metadata - Metadata object containing backup information
 * @returns The manifest object as a plain JavaScript object
 */
export function generateManifest(metadata: Omit<BackupMetadata, 'version' | 'timestamp'>): BackupMetadata {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ...metadata,
  };
}

/**
 * Calculates SHA-256 checksum for a file
 *
 * @param filePath - Path to the file
 * @returns Promise containing the hex checksum
 */
async function calculateChecksum(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Creates a tar.gz archive containing all user data and files
 *
 * Streams the archive to the provided writable stream
 *
 * @param userId - The user ID to create backup for
 * @param writable - Writable stream to write the archive to
 * @returns Promise that resolves when archive is complete
 */
export async function createArchive(
  userId: string,
  writable: NodeJS.WritableStream
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Export user data
    const userData = await exportUserData(userId);
    const files = await collectFiles(userId);

    // Calculate checksums for all files
    const checksumPromises = files.map(async (file) => {
      const checksum = await calculateChecksum(file.path);
      return { [file.archivePath]: checksum };
    });

    const checksumResults = await Promise.all(checksumPromises);
    const checksums = Object.assign({}, ...checksumResults);

    // Generate manifest
    const manifest = generateManifest({
      userId,
      userEmail: userData.user.email,
      username: userData.user.username,
      checksums,
    });

    // Create archiver with tar and gzip (level 6)
    const archive = archiver('tar', {
      gzip: true,
    });

    // Handle errors
    archive.on('error', (err: Error) => {
      reject(err);
    });

    writable.on('error', (err: Error) => {
      reject(err);
    });

    // Use stream.finished() on the ARCHIVER stream to wait for gzip compression to complete
    // The archiver is a Transform stream with BOTH readable and writable sides
    const archiveFinished = finished(archive, { readable: true, writable: true });

    // Pipe archive to writable stream
    archive.pipe(writable);

    // Add manifest.json to archive
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add database exports
    archive.append(JSON.stringify(userData.journals, null, 2), {
      name: 'database/journals.json',
    });
    archive.append(JSON.stringify(userData.notes, null, 2), {
      name: 'database/notes.json',
    });
    archive.append(JSON.stringify(userData.journalNotes, null, 2), {
      name: 'database/journalNotes.json',
    });
    archive.append(JSON.stringify(userData.templates, null, 2), {
      name: 'database/templates.json',
    });
    archive.append(JSON.stringify(userData.dailyMoods, null, 2), {
      name: 'database/dailyMoods.json',
    });
    archive.append(JSON.stringify(userData.transcripts, null, 2), {
      name: 'database/transcripts.json',
    });
    archive.append(JSON.stringify(userData.tags, null, 2), {
      name: 'database/tags.json',
    });

    // Add files to archive
    for (const file of files) {
      try {
        archive.file(file.path, { name: file.archivePath });
      } catch {
        // Skip files that can't be added
      }
    }

    // Finalize the archive
    try {
      await archive.finalize();
    } catch (err) {
      reject(err);
      return;
    }

    // Wait for archive transform stream to finish
    try {
      await archiveFinished;
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates a complete backup archive for a user
 *
 * This is the main entry point for backup operations. It creates a tar.gz
 * archive containing all user data and files, and returns the path to the
 * created archive.
 *
 * @param userId - The user ID to create backup for
 * @param onProgress - Optional callback for progress updates
 * @returns Promise containing the archive path
 */
export async function createBackup(
  userId: string,
  onProgress?: BackupProgressCallback
): Promise<{ archivePath: string; filename: string }> {
  // Ensure backup directory exists
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create backup directory:', error);
  }

  // Notify progress: Starting
  onProgress?.({ step: 'Initializing backup', stepIndex: 0, percentage: 0 });

  // Generate unique filename for backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `weft-backup-${timestamp}-${userId}.tar.gz`;
  const archivePath = join(BACKUP_DIR, filename);

  // Create writable stream to file
  const fs = await import('node:fs');
  const fsPromises = await import('node:fs/promises');
  const writable = fs.createWriteStream(archivePath);

  // Log file info after creation for debugging
  writable.on('close', async () => {
    try {
      const stats = await fsPromises.stat(archivePath);
      console.log(`[Backup] Final file size: ${stats.size} bytes`);
      // Read first 10 bytes to check magic bytes (gzip should start with 1f 8b)
      const buffer = Buffer.alloc(10);
      const fd = await fsPromises.open(archivePath, 'r');
      await fd.read(buffer, 0, 10, 0);
      await fd.close();
      console.log(`[Backup] First 10 bytes (hex): ${buffer.toString('hex').substring(0, 20)}`);
      console.log(`[Backup] Expected gzip magic: 1f 8b`);
    } catch (err) {
      console.error('[Backup] Error checking file:', err);
    }
  });

  // Notify progress: Exporting data
  onProgress?.({ step: 'Exporting user data', stepIndex: 1, percentage: 20 });

  // Create the archive
  await new Promise<void>((resolve, reject) => {
    // Export user data
    exportUserData(userId)
      .then(async (userData) => {
        // Notify progress: Collecting files
        onProgress?.({ step: 'Collecting files', stepIndex: 2, percentage: 40 });

        const files = await collectFiles(userId);

        // Calculate checksums for all files
        onProgress?.({ step: 'Calculating checksums', stepIndex: 3, percentage: 60 });

        const checksumPromises = files.map(async (file) => {
          const checksum = await calculateChecksum(file.path);
          return { [file.archivePath]: checksum };
        });

        const checksumResults = await Promise.all(checksumPromises);
        const checksums = Object.assign({}, ...checksumResults);

        // Generate manifest
        const manifest = generateManifest({
          userId,
          userEmail: userData.user.email,
          username: userData.user.username,
          checksums,
        });

        // Create archiver with tar and gzip (level 6)
        const archive = archiver('tar', {
          gzip: true,
        });

        // Handle errors
        archive.on('error', (err: Error) => {
          console.error('[Backup] Archive error:', err);
          reject(err);
        });

        // Handle warnings
        archive.on('warning', (err: Error) => {
          console.warn('[Backup] Archive warning:', err);
        });

        // Handle errors on both streams
        archive.on('error', (err: Error) => {
          console.error('[Backup] Archive error:', err);
          reject(err);
        });

        writable.on('error', (err: Error) => {
          console.error('[Backup] Writable stream error:', err);
          reject(err);
        });

        // Handle progress
        archive.on('progress', (progress: any) => {
          const percentage = Math.min(95, 60 + Math.floor((progress.entries.processed / (progress.entries.total || 1)) * 30));
          console.log(`[Backup] Archive progress: ${progress.entries.processed}/${progress.entries.total} entries, ${progress.fs.totalBytes} bytes`);
          onProgress?.({ step: 'Creating archive', stepIndex: 4, percentage });
        });

        // Use stream.finished() on the ARCHIVER stream to wait for gzip compression to complete
        // The archiver is a Transform stream with BOTH readable and writable sides
        const archiveFinished = finished(archive, { readable: true, writable: true });

        // Pipe archive to writable stream
        archive.pipe(writable);

        // Log end for debugging
        archive.on('end', () => {
          console.log('[Backup] Archive ended');
        });

        // Add all content to archive
        // Add manifest.json to archive
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        // Add database exports
        archive.append(JSON.stringify(userData.journals, null, 2), {
          name: 'database/journals.json',
        });
        archive.append(JSON.stringify(userData.notes, null, 2), {
          name: 'database/notes.json',
        });
        archive.append(JSON.stringify(userData.journalNotes, null, 2), {
          name: 'database/journalNotes.json',
        });
        archive.append(JSON.stringify(userData.templates, null, 2), {
          name: 'database/templates.json',
        });
        archive.append(JSON.stringify(userData.dailyMoods, null, 2), {
          name: 'database/dailyMoods.json',
        });
        archive.append(JSON.stringify(userData.transcripts, null, 2), {
          name: 'database/transcripts.json',
        });
        archive.append(JSON.stringify(userData.tags, null, 2), {
          name: 'database/tags.json',
        });

        // Add files to archive
        console.log(`[Backup] Adding ${files.length} files to archive`);
        for (const file of files) {
          try {
            console.log(`[Backup] Adding file: ${file.path} -> ${file.archivePath}`);
            archive.file(file.path, { name: file.archivePath });
          } catch (err) {
            console.error(`[Backup] Failed to add file ${file.path}:`, err);
          }
        }

        console.log(`[Backup] Finalizing archive...`);

        // Finalize the archive
        try {
          await archive.finalize();
          console.log('[Backup] Archive finalize() completed');
        } catch (err) {
          reject(err);
          return;
        }

        // Wait for archive transform stream to finish (all compression complete)
        try {
          await archiveFinished;
          console.log('[Backup] Archive stream finished, gzip compression complete');
          onProgress?.({ step: 'Backup completed', stepIndex: 5, percentage: 100 });
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });

  console.log(`[Backup] Created backup archive: ${archivePath}`);

  return { archivePath, filename };
}
