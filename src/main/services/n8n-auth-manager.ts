import axios, { AxiosInstance } from 'axios';
import { ConfigManager, N8nOwnerCredentials } from '../config-manager';
import { safeStorage } from 'electron';

export interface OwnerSetupResult {
  success: boolean;
  error?: string;
}

export interface LoginResult {
  success: boolean;
  cookie?: string;
  error?: string;
}

export interface ApiKeyResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

const DEFAULT_OWNER_EMAIL = 'desktop@n8n.local';
const DEFAULT_OWNER_FIRST_NAME = 'Desktop';
const DEFAULT_OWNER_LAST_NAME = 'User';

/**
 * Generates a secure random password for the n8n owner account
 */
function generateSecurePassword(): string {
  const length = 24;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each required type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Manages n8n owner account setup and authentication
 */
export class N8nAuthManager {
  private configManager: ConfigManager;
  private axiosInstance: AxiosInstance;
  private sessionCookie: string | null = null;
  private apiKey: string | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.axiosInstance = axios.create({
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
    // Load stored API key
    this.apiKey = configManager.get('n8nApiKey') as string | null;
    console.log('N8nAuthManager initialized, API key loaded:', this.apiKey ? 'yes (length: ' + this.apiKey.length + ')' : 'no');
  }

  /**
   * Get the base URL for n8n REST API
   */
  private getBaseUrl(): string {
    const port = this.configManager.get('n8nPort') ?? 5678;
    return `http://localhost:${port}`;
  }

  /**
   * Check if the owner is already set up by querying n8n
   */
  async isOwnerSetUp(): Promise<boolean> {
    try {
      // Check the /rest/settings endpoint to see if owner is set up
      const response = await this.axiosInstance.get(`${this.getBaseUrl()}/rest/settings`);

      if (response.status === 200 && response.data) {
        // If userManagement.isInstanceOwnerSetUp is true, owner is set up
        return response.data.userManagement?.isInstanceOwnerSetUp === true;
      }

      return false;
    } catch (error) {
      console.error('Error checking owner setup status:', error);
      return false;
    }
  }

  /**
   * Wait for n8n to be ready for API calls
   */
  async waitForN8nReady(maxAttempts: number = 30, intervalMs: number = 1000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.axiosInstance.get(`${this.getBaseUrl()}/healthz`);
        if (response.status === 200) {
          // Give it a bit more time for all endpoints to be ready
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return true;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  /**
   * Set up the owner account automatically
   * Returns success: true if owner is set up (either newly created or already exists)
   */
  async setupOwner(): Promise<OwnerSetupResult> {
    try {
      // Check if already set up via settings endpoint
      const isSetUp = await this.isOwnerSetUp();
      if (isSetUp) {
        console.log('Owner already set up (detected via settings), skipping setup');
        return { success: true };
      }

      // Get or generate credentials
      const credentials = this.getOrCreateCredentials();

      // Call the owner setup endpoint
      const response = await this.axiosInstance.post(
        `${this.getBaseUrl()}/rest/owner/setup`,
        {
          email: credentials.email,
          firstName: credentials.firstName,
          lastName: credentials.lastName,
          password: this.decryptPassword(credentials.encryptedPassword!),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200) {
        console.log('Owner account created successfully');

        // Extract and store the session cookie
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          this.sessionCookie = this.extractSessionCookie(setCookieHeader);
        }

        // Mark owner setup as complete
        this.configManager.set('n8nOwnerSetupComplete', true);

        return { success: true };
      } else {
        // Check if the error is "owner already exists" - this is actually OK
        const errorMessage = response.data?.message || '';
        if (errorMessage.toLowerCase().includes('already') ||
            errorMessage.toLowerCase().includes('owner') ||
            response.status === 400) {
          console.log('Owner already set up (detected via setup response), proceeding...');
          return { success: true };
        }

        console.error('Owner setup failed:', errorMessage || `status ${response.status}`);
        return { success: false, error: errorMessage || `Setup failed with status ${response.status}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during owner setup';
      console.error('Error setting up owner:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Login to n8n and get session cookie
   */
  async login(): Promise<LoginResult> {
    try {
      const credentials = this.configManager.get('n8nOwnerCredentials') as N8nOwnerCredentials | undefined;
      console.log('Login attempt with credentials:', credentials ? credentials.email : 'no credentials');

      if (!credentials || !credentials.encryptedPassword) {
        return { success: false, error: 'No credentials stored' };
      }

      const password = this.decryptPassword(credentials.encryptedPassword);

      // n8n uses 'emailOrLdapLoginId' field name for the login endpoint
      const response = await this.axiosInstance.post(
        `${this.getBaseUrl()}/rest/login`,
        {
          emailOrLdapLoginId: credentials.email,
          password: password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Login response status:', response.status);

      if (response.status === 200) {
        const setCookieHeader = response.headers['set-cookie'];
        console.log('Login set-cookie header:', setCookieHeader ? 'present' : 'missing');
        if (setCookieHeader) {
          this.sessionCookie = this.extractSessionCookie(setCookieHeader);
          console.log('Session cookie extracted:', this.sessionCookie ? 'yes' : 'no');
          return { success: true, cookie: this.sessionCookie || undefined };
        }
        return { success: true };
      } else {
        console.error('Login failed:', response.status, JSON.stringify(response.data));
        return { success: false, error: `Login failed with status ${response.status}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during login';
      console.error('Login error:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Create an API key for programmatic access
   */
  async createApiKey(): Promise<ApiKeyResult> {
    console.log('createApiKey called, sessionCookie:', this.sessionCookie ? 'present' : 'null');

    if (!this.sessionCookie) {
      return { success: false, error: 'Not logged in, cannot create API key' };
    }

    // Check if we already have an API key stored
    if (this.apiKey) {
      console.log('API key already exists, returning existing key');
      return { success: true, apiKey: this.apiKey };
    }

    try {
      console.log('Creating new API key via POST /rest/api-keys');
      const response = await this.axiosInstance.post(
        `${this.getBaseUrl()}/rest/api-keys`,
        {
          // Required: label for the API key
          label: 'n8n-desktop-auto',
          // API key scopes - workflow management scopes
          scopes: [
            'workflow:list',
            'workflow:read',
            'workflow:create',
            'workflow:update',
            'workflow:delete',
            'workflow:execute',
          ],
          // Set expiration to 10 years from now (Unix timestamp in milliseconds)
          expiresAt: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: this.sessionCookie,
          },
        }
      );

      console.log('API key creation response status:', response.status);
      console.log('API key creation response data:', JSON.stringify(response.data));

      if (response.status === 200 || response.status === 201) {
        // The rawApiKey contains the actual key value
        const apiKey = response.data?.rawApiKey || response.data?.apiKey || response.data?.data?.rawApiKey;
        if (apiKey) {
          this.apiKey = apiKey;
          this.configManager.set('n8nApiKey', apiKey);
          console.log('API key created and stored successfully');
          return { success: true, apiKey };
        }
        console.error('API key not found in response structure');
        return { success: false, error: 'API key not found in response' };
      } else {
        console.error('API key creation failed with status:', response.status);
        return { success: false, error: `Failed to create API key: ${response.status} - ${JSON.stringify(response.data)}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating API key:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Get the current session cookie for API calls
   */
  getSessionCookie(): string | null {
    return this.sessionCookie;
  }

  /**
   * Get the session cookie value only (without the name= prefix)
   */
  getSessionCookieValue(): string | null {
    if (!this.sessionCookie) return null;
    // Cookie format is "n8n-auth=value", extract just the value
    const match = this.sessionCookie.match(/n8n-auth=(.+)/);
    return match ? match[1] : null;
  }

  /**
   * Get the n8n port
   */
  getN8nPort(): number {
    return this.configManager.get('n8nPort') ?? 5678;
  }

  /**
   * Create axios config with authentication using session cookie
   */
  getAuthHeaders(): Record<string, string> {
    console.log('getAuthHeaders called - sessionCookie:', this.sessionCookie ? 'present' : 'null');
    if (this.sessionCookie) {
      console.log('Using session cookie for authentication');
      return { Cookie: this.sessionCookie };
    }
    console.warn('No authentication available!');
    return {};
  }

  /**
   * Get or create owner credentials
   */
  private getOrCreateCredentials(): N8nOwnerCredentials {
    let credentials = this.configManager.get('n8nOwnerCredentials') as N8nOwnerCredentials | undefined;

    if (!credentials || !credentials.encryptedPassword) {
      const password = generateSecurePassword();
      credentials = {
        email: DEFAULT_OWNER_EMAIL,
        firstName: DEFAULT_OWNER_FIRST_NAME,
        lastName: DEFAULT_OWNER_LAST_NAME,
        encryptedPassword: this.encryptPassword(password),
      };
      this.configManager.set('n8nOwnerCredentials', credentials);
    }

    return credentials;
  }

  /**
   * Encrypt password using Electron's safeStorage
   */
  private encryptPassword(password: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password);
      return encrypted.toString('base64');
    }
    // Fallback: base64 encode (not secure, but better than plaintext)
    console.warn('Safe storage not available, using base64 encoding');
    return Buffer.from(password).toString('base64');
  }

  /**
   * Decrypt password
   */
  private decryptPassword(encryptedPassword: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedPassword, 'base64');
      return safeStorage.decryptString(buffer);
    }
    // Fallback: base64 decode
    return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
  }

  /**
   * Extract session cookie from Set-Cookie header
   */
  private extractSessionCookie(setCookieHeader: string[]): string | null {
    console.log('Extracting session cookie from headers:', JSON.stringify(setCookieHeader));
    for (const cookie of setCookieHeader) {
      // n8n uses 'n8n-auth' cookie for session
      if (cookie.includes('n8n-auth=')) {
        // Extract just the cookie value part (before any attributes like ; Path=)
        const match = cookie.match(/n8n-auth=[^;]+/);
        if (match) {
          console.log('Found n8n-auth cookie:', match[0].substring(0, 30) + '...');
          return match[0];
        }
      }
    }
    console.warn('No n8n-auth cookie found in headers');
    return null;
  }

  /**
   * Ensure owner is set up and logged in, return true if successful
   */
  async ensureAuthenticated(): Promise<boolean> {
    console.log('ensureAuthenticated called');
    console.log('Current state - sessionCookie:', this.sessionCookie ? 'present' : 'null');

    // If we already have a session cookie, we're good
    if (this.sessionCookie) {
      console.log('Using existing session cookie for authentication');
      return true;
    }

    // First, ensure owner is set up
    console.log('Setting up owner...');
    const setupResult = await this.setupOwner();
    if (!setupResult.success) {
      console.error('Failed to set up owner:', setupResult.error);
      return false;
    }
    console.log('Owner setup complete, sessionCookie:', this.sessionCookie ? 'present' : 'null');

    // If we don't have a session cookie from setup, login
    if (!this.sessionCookie) {
      console.log('No session cookie from setup, attempting login...');
      const loginResult = await this.login();
      if (!loginResult.success) {
        console.error('Failed to login:', loginResult.error);
        return false;
      }
      console.log('Login complete, sessionCookie:', this.sessionCookie ? 'present' : 'null');
    }

    console.log('Authentication complete - sessionCookie:', this.sessionCookie ? 'present' : 'null');
    return this.sessionCookie !== null;
  }

  /**
   * Clear session (for logout or restart)
   */
  clearSession(): void {
    this.sessionCookie = null;
  }
}
