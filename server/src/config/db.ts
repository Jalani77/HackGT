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
    uri = server.getUri('campus-discovery');
    console.log(`[db] dev MongoDB running at ${uri} (data: ${env.devDbPath})`);
  }

  await mongoose.connect(uri);
  await mongoose.connection.syncIndexes();
  console.log('[db] connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
