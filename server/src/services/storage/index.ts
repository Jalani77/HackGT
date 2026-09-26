import { env } from '../../config/env';
import { LocalStorageService } from './LocalStorageService';
import type { StorageService } from './StorageService';

export type { StorageService, StoredObject } from './StorageService';

function createStorageService(): StorageService {
  switch (env.IMAGE_STORAGE_DRIVER) {
    case 'local':
      return new LocalStorageService(env.uploadsDir, env.IMAGE_STORAGE_URL);
  }
}

export const storageService = createStorageService();
