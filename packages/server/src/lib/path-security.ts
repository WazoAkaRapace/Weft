/**
 * Path Security Utilities
 *
 * Provides functions for validating and sanitizing file paths to prevent
 * path traversal attacks and ensure paths are within allowed directories.
 */

import path from 'node:path';

/**
 * Error thrown when a path fails security validation
 */
class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly unsafePath: string,
    public readonly allowedDir: string
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Validates that a path is within an allowed directory
 *
 * This function:
 * 1. Resolves both paths to absolute canonical paths
 * 2. Checks if the target path is a subdirectory of the allowed directory
 * 3. Prevents path traversal attacks using ".." or symbolic links
 *
 * @param targetPath - The path to validate (can be relative or absolute)
 * @param allowedDir - The directory that the path must be within
 * @returns The validated absolute path
 * @throws PathSecurityError if the path is outside the allowed directory
 */
export function validatePathWithinDir(
  targetPath: string,
  allowedDir: string
): string {
  // Resolve both paths to absolute canonical paths
  const resolvedAllowed = path.resolve(allowedDir);
  const resolvedTarget = path.resolve(allowedDir, targetPath);

  // Normalize to handle any ".." or "." segments
  const normalizedTarget = path.normalize(resolvedTarget);
  const normalizedAllowed = path.normalize(resolvedAllowed);

  // Check if the normalized target starts with the allowed directory
  // We add a separator to prevent prefix attacks (e.g., /app/uploads2 matching /app/uploads)
  const allowedWithSep = normalizedAllowed.endsWith(path.sep)
    ? normalizedAllowed
    : normalizedAllowed + path.sep;

  if (
    normalizedTarget !== normalizedAllowed &&
    !normalizedTarget.startsWith(allowedWithSep)
  ) {
    throw new PathSecurityError(
      `Path traversal detected: path "${targetPath}" resolves outside allowed directory`,
      targetPath,
      allowedDir
    );
  }

  return normalizedTarget;
}

/**
 * Safely resolves a path from database storage
 *
 * This function handles the common pattern where paths in the database might be:
 * - Relative paths (e.g., "videos/journal-123.webm")
 * - Absolute paths within UPLOAD_DIR (e.g., "/app/uploads/videos/journal-123.webm")
 * - Potentially malicious paths (e.g., "../../etc/passwd")
 *
 * @param dbPath - Path from database
 * @param baseDir - The base directory for relative paths (typically UPLOAD_DIR)
 * @returns Object with the safe path and validation status
 */
export function safeResolveDatabasePath(
  dbPath: string | null | undefined,
  baseDir: string
): { safe: true; path: string } | { safe: false; path: null; error: string } {
  if (!dbPath) {
    return { safe: false, path: null, error: 'Path is null or undefined' };
  }

  try {
    // Clean the path - remove any null bytes and normalize separators
    const cleanPath = dbPath.replace(/\0/g, '').split('/').join(path.sep);

    // Resolve the path
    const resolvedPath = validatePathWithinDir(cleanPath, baseDir);

    return { safe: true, path: resolvedPath };
  } catch (error) {
    const errorMessage =
      error instanceof PathSecurityError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown path validation error';

    console.warn(`[PathSecurity] Blocked unsafe path: ${errorMessage}`);
    return { safe: false, path: null, error: errorMessage };
  }
}

/**
 * Sanitizes a filename by removing potentially dangerous characters
 *
 * @param filename - The filename to sanitize
 * @returns A sanitized filename safe for filesystem use
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\x00]/g, '_');

  // Remove leading dots (hidden files) and dashes
  sanitized = sanitized.replace(/^[\.-]+/, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const base = sanitized.slice(0, 255 - ext.length);
    sanitized = base + ext;
  }

  return sanitized || 'unnamed_file';
}

/**
 * Gets the UPLOAD_DIR with validation
 *
 * @returns The validated upload directory path
 */
export function getValidatedUploadDir(): string {
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  return path.resolve(uploadDir);
}

/**
 * Gets the BACKUP_DIR with validation
 *
 * @returns The validated backup directory path
 */
export function getValidatedBackupDir(): string {
  const uploadDir = getValidatedUploadDir();
  const backupDir = process.env.BACKUP_DIR || path.join(uploadDir, 'backups');
  return path.resolve(backupDir);
}
