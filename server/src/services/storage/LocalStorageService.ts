import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageService, StoredObject } from './StorageService';

/** Writes to a local directory served statically. Swap for S3/R2/Cloudinary in production. */
export class LocalStorageService implements StorageService {
  constructor(
    private rootDir: string,
    private publicBaseUrl: string,
  ) {}

  private resolve(key: string): string {
    const full = path.resolve(this.rootDir, key);
    // Guard against path traversal via crafted keys.
    if (!full.startsWith(path.resolve(this.rootDir) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, url: `${this.publicBaseUrl.replace(/\/$/, '')}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
