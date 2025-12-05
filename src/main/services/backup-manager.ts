/**
 * Backup Manager - Handles backup and restore of n8n data
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statfsSync } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { ConfigManager } from '../config-manager';

// Minimum required free space for backup (50MB buffer)
const MIN_FREE_SPACE_BYTES = 50 * 1024 * 1024;

export interface BackupInfo {
  id: string;
  filename: string;
  path: string;
  createdAt: string;
  size: number;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
}

export interface ListBackupsResult {
  success: boolean;
  backups?: BackupInfo[];
  error?: string;
}

export class BackupManager {
  private configManager: ConfigManager;
  private backupsDir: string;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.backupsDir = path.join(configManager.get('dataFolder'), 'backups');
    this.ensureBackupsDir();
  }

  private ensureBackupsDir(): void {
    if (!existsSync(this.backupsDir)) {
      mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  /**
   * Check available disk space
   */
  private checkDiskSpace(): { available: boolean; freeBytes: number; error?: string } {
    try {
      const stats = statfsSync(this.backupsDir);
      const freeBytes = stats.bfree * stats.bsize;
      return {
        available: freeBytes >= MIN_FREE_SPACE_BYTES,
        freeBytes,
      };
    } catch (error) {
      return {
        available: false,
        freeBytes: 0,
        error: error instanceof Error ? error.message : 'Failed to check disk space',
      };
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Create a backup of the n8n data folder
   */
  async createBackup(): Promise<BackupResult> {
    try {
      this.ensureBackupsDir();

      // Check disk space before starting
      const diskSpace = this.checkDiskSpace();
      if (!diskSpace.available) {
        const freeSpace = this.formatBytes(diskSpace.freeBytes);
        const required = this.formatBytes(MIN_FREE_SPACE_BYTES);
        return {
          success: false,
          error: `Insufficient disk space for backup. Available: ${freeSpace}, Required: at least ${required}. Please free up disk space and try again.`,
        };
      }

      const dataFolder = this.configManager.get('dataFolder');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `backup-${timestamp}`;
      const backupFilename = `${backupId}.tar.gz`;
      const backupPath = path.join(this.backupsDir, backupFilename);

      // Get list of files to backup (excluding backups folder)
      const filesToBackup = await this.getFilesToBackup(dataFolder);

      if (filesToBackup.length === 0) {
        return {
          success: false,
          error: 'No files to backup',
        };
      }

      // Create a simple tar-like archive (JSON manifest + files)
      const archive = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        files: [] as { path: string; content: string }[],
      };

      for (const filePath of filesToBackup) {
        const relativePath = path.relative(dataFolder, filePath);
        try {
          const content = await fs.readFile(filePath, 'base64');
          archive.files.push({ path: relativePath, content });
        } catch {
          // Skip files that can't be read
          console.warn(`Could not backup file: ${filePath}`);
        }
      }

      // Write archive as compressed JSON
      const archiveJson = JSON.stringify(archive);
      const tempPath = `${backupPath}.tmp`;

      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(tempPath);
        const gzip = createGzip();

        gzip.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        gzip.pipe(writeStream);
        gzip.write(archiveJson);
        gzip.end();
      });

      // Rename temp file to final name
      await fs.rename(tempPath, backupPath);

      // Get file stats
      const stats = await fs.stat(backupPath);

      const backup: BackupInfo = {
        id: backupId,
        filename: backupFilename,
        path: backupPath,
        createdAt: new Date().toISOString(),
        size: stats.size,
      };

      return { success: true, backup };
    } catch (error) {
      // Check for specific error types
      const errorCode = (error as NodeJS.ErrnoException).code;
      let errorMessage: string;

      if (errorCode === 'ENOSPC') {
        errorMessage = 'Insufficient disk space. The backup could not be completed because there is not enough free space on the disk.';
      } else if (errorCode === 'EACCES') {
        errorMessage = 'Permission denied. Unable to write to the backup directory.';
      } else if (errorCode === 'EROFS') {
        errorMessage = 'Read-only file system. The backup directory is on a read-only drive.';
      } else {
        errorMessage = error instanceof Error ? error.message : 'Failed to create backup';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Restore from a backup file
   */
  async restoreBackup(backupPath: string): Promise<RestoreResult> {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found' };
      }

      const dataFolder = this.configManager.get('dataFolder');

      // Read and decompress backup
      const chunks: Buffer[] = [];
      await pipeline(
        createReadStream(backupPath),
        createGunzip(),
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk as Buffer);
            yield chunk;
          }
        }
      );

      const archiveJson = Buffer.concat(chunks).toString('utf-8');
      const archive = JSON.parse(archiveJson) as {
        version: string;
        files: { path: string; content: string }[];
      };

      if (!archive.version || !archive.files) {
        return { success: false, error: 'Invalid backup format' };
      }

      // Restore files
      for (const file of archive.files) {
        const filePath = path.join(dataFolder, file.path);
        const fileDir = path.dirname(filePath);

        // Ensure directory exists
        await fs.mkdir(fileDir, { recursive: true });

        // Write file
        const content = Buffer.from(file.content, 'base64');
        await fs.writeFile(filePath, content);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<ListBackupsResult> {
    try {
      this.ensureBackupsDir();

      const files = await fs.readdir(this.backupsDir);
      const backups: BackupInfo[] = [];

      for (const filename of files) {
        if (filename.endsWith('.tar.gz')) {
          const filePath = path.join(this.backupsDir, filename);
          try {
            const stats = await fs.stat(filePath);
            const id = filename.replace('.tar.gz', '');

            backups.push({
              id,
              filename,
              path: filePath,
              createdAt: stats.mtime.toISOString(),
              size: stats.size,
            });
          } catch {
            // Skip files that can't be read
          }
        }
      }

      // Sort by creation date, newest first
      backups.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return { success: true, backups };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list backups',
      };
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupPath = path.join(this.backupsDir, `${backupId}.tar.gz`);

      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup not found' };
      }

      await fs.unlink(backupPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup',
      };
    }
  }

  /**
   * Get list of files to backup
   */
  private async getFilesToBackup(dataFolder: string): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = ['backups', 'node_modules', '.git', 'logs'];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Include common data files
            const ext = path.extname(entry.name).toLowerCase();
            if (['.json', '.sqlite', '.db', '.yaml', '.yml', '.env'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    await scanDir(dataFolder);
    return files;
  }
}
