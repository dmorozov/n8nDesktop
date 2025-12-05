import { EventEmitter } from 'events';
import { app } from 'electron';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  mandatory: boolean;
}

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
}

// GitHub releases API endpoint - replace with actual repo
const GITHUB_OWNER = 'n8n-io';
const GITHUB_REPO = 'n8n-desktop';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Check interval: 4 hours
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

export class UpdateChecker extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheck: Date | null = null;
  private cachedUpdateInfo: UpdateInfo | null = null;
  private isDismissed: boolean = false;

  constructor() {
    super();
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion();

    try {
      const response = await fetch(RELEASES_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `n8n-desktop/${currentVersion}`,
        },
      });

      if (!response.ok) {
        // If repo doesn't exist or rate limited, return no update
        if (response.status === 404 || response.status === 403) {
          return {
            available: false,
            currentVersion,
          };
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name?.replace(/^v/, '') || '';

      // Compare versions
      const isNewer = this.isNewerVersion(latestVersion, currentVersion);

      if (isNewer) {
        const updateInfo: UpdateInfo = {
          version: latestVersion,
          releaseDate: release.published_at || new Date().toISOString(),
          releaseNotes: release.body || 'No release notes available.',
          downloadUrl: release.html_url || '',
          mandatory: false,
        };

        this.cachedUpdateInfo = updateInfo;
        this.lastCheck = new Date();

        // Emit update available event
        this.emit('updateAvailable', updateInfo);

        return {
          available: true,
          currentVersion,
          latestVersion,
          updateInfo,
        };
      }

      this.lastCheck = new Date();
      return {
        available: false,
        currentVersion,
        latestVersion,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking for updates:', errorMessage);

      return {
        available: false,
        currentVersion,
        error: errorMessage,
      };
    }
  }

  /**
   * Compare semantic versions
   * Returns true if version1 > version2
   */
  private isNewerVersion(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1 = v1Parts[i] || 0;
      const v2 = v2Parts[i] || 0;

      if (v1 > v2) return true;
      if (v1 < v2) return false;
    }

    return false;
  }

  /**
   * Start automatic update checking
   */
  startAutoCheck(): void {
    // Check immediately
    this.checkForUpdates();

    // Then check periodically
    this.checkInterval = setInterval(() => {
      if (!this.isDismissed) {
        this.checkForUpdates();
      }
    }, CHECK_INTERVAL);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Dismiss current update notification
   */
  dismissUpdate(): void {
    this.isDismissed = true;
    this.emit('updateDismissed');
  }

  /**
   * Reset dismissed state (e.g., when a new version is found)
   */
  resetDismissed(): void {
    this.isDismissed = false;
  }

  /**
   * Get cached update info
   */
  getCachedUpdateInfo(): UpdateInfo | null {
    return this.cachedUpdateInfo;
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): Date | null {
    return this.lastCheck;
  }

  /**
   * Get download URL for the update
   */
  getDownloadUrl(): string {
    return this.cachedUpdateInfo?.downloadUrl || '';
  }
}
