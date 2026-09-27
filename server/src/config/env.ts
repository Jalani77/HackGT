import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Root .env first (shared with client), then optional server/.env overrides.
dotenv.config({ path: path.resolve(serverRoot, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(serverRoot, '.env'), override: true, quiet: true });

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().optional().default(''),
  MONGODB_DB: z.string().default('campus-discovery'),
  JWT_SECRET: z.string().default(''),
  AI_PROVIDER: z.enum(['openai', 'mock']).default('openai'),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().default(30000),
  IMAGE_STORAGE_DRIVER: z.enum(['local']).default('local'),
  IMAGE_STORAGE_URL: z.string().default('/uploads'),
  IMAGE_STORAGE_KEY: z.string().optional().default(''),
  /** Where re-downloadable caches live (MongoDB binary, seed photos). Empty → server/.cache. */
  CACHE_DIR: z.string().optional().default(''),
  DEFAULT_CAMPUS_ID: z.string().default('gatech'),
  DEFAULT_CAMPUS_NAME: z.string().default('Georgia Tech'),
});

const parsed = schema.parse(process.env);
const isProd = parsed.NODE_ENV === 'production';

if (!parsed.JWT_SECRET) {
  if (isProd) throw new Error('JWT_SECRET must be set in production');
  parsed.JWT_SECRET = 'dev-only-insecure-secret';
  console.warn('[env] JWT_SECRET not set — using an insecure dev secret.');
}

// Fall back to the mock recognizer only when no key is configured, and say so loudly.
const aiProvider = parsed.AI_PROVIDER === 'openai' && !parsed.AI_API_KEY ? 'mock' : parsed.AI_PROVIDER;
if (aiProvider === 'mock') {
  console.warn(
    parsed.AI_PROVIDER === 'mock'
      ? '[env] AI_PROVIDER=mock — using MockRecognitionService (no real identification).'
      : '[env] AI_API_KEY not set — using MockRecognitionService (no real identification).',
  );
}

/**
 * Resolve the cache directory. A configured CACHE_DIR that can't be created (e.g. a removable
 * drive that isn't plugged in) falls back to the in-project default instead of crashing.
 */
function resolveCacheDir(): string {
  const fallback = path.resolve(serverRoot, '.cache');
  const configured = parsed.CACHE_DIR.trim();
  const dir = configured ? path.resolve(configured) : fallback;
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.warn(`[env] CACHE_DIR "${dir}" is not available (${(err as Error).message}). Using ${fallback}.`);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const cacheDir = resolveCacheDir();
// mongodb-memory-server reads this when it downloads/looks up the mongod binary.
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(cacheDir, 'mongodb-binaries');

export const env = {
  ...parsed,
  isProd,
  aiProvider,
  serverRoot,
  cacheDir,
  uploadsDir: path.resolve(serverRoot, 'uploads'),
  devDbPath: path.resolve(serverRoot, '.data/mongo'),
};
