import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { api } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.isProd ? false : true }));
  app.use(express.json({ limit: '100kb' }));

  // Local image storage. Replaced by a CDN/bucket URL when using cloud storage.
  if (env.IMAGE_STORAGE_DRIVER === 'local') {
    app.use(env.IMAGE_STORAGE_URL, express.static(env.uploadsDir, { maxAge: '7d', index: false }));
  }

  app.use('/api', api);
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
