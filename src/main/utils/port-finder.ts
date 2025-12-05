import { createServer, AddressInfo } from 'net';

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available port found after ${maxAttempts} attempts starting from ${startPort}`);
}

/**
 * Get a random available port
 */
export async function getRandomAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (err) => {
      reject(err);
    });

    server.once('listening', () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      server.close(() => {
        resolve(port);
      });
    });

    // Port 0 means OS will assign a random available port
    server.listen(0, '127.0.0.1');
  });
}
