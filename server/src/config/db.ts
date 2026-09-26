import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from './env';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

/**
 * Connects to MONGODB_URI when set (Atlas / production). Otherwise starts a real
 * mongod via mongodb-memory-server with an on-disk dbPath, so dev data survives restarts.
 */
export async function connectDatabase(): Promise<void> {
  let uri = env.MONGODB_URI;

  if (!uri) {
    if (env.isProd) throw new Error('MONGODB_URI must be set in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    fs.mkdirSync(env.devDbPath, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: { dbPath: env.devDbPath, storageEngine: 'wiredTiger', port: 27027 },
    });
    memoryServer = server;
    uri = server.getUri();
    console.log(`[db] dev MongoDB running (data: ${env.devDbPath})`);
  }

  try {
    // dbName is explicit so an Atlas URI without a path doesn't silently use "test".
    await mongoose.connect(uri, { dbName: env.MONGODB_DB, serverSelectionTimeoutMS: 10_000 });
    await mongoose.connection.syncIndexes();
  } catch (err) {
    if (env.MONGODB_URI) {
      console.error(
        '\n[db] Could not connect to MongoDB Atlas. Most common causes:\n' +
          '  1. This machine\'s IP is not in Atlas → Security → Network Access (TLS "alert number 80" = blocked IP)\n' +
          '  2. Wrong username/password in MONGODB_URI\n' +
          '  Tip: leave MONGODB_URI empty to use the local dev database instead.\n',
      );
    }
    throw err;
  }
  console.log(`[db] connected to "${env.MONGODB_DB}" (${env.MONGODB_URI ? 'Atlas/remote' : 'local dev'})`);

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
