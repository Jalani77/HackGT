import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { ApiError } from '../../../shared/types';
import { AppError } from '../utils/AppError';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } } satisfies ApiError);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let e: AppError;
  if (err instanceof AppError) e = err;
  else if (err instanceof ZodError)
    e = new AppError('VALIDATION', err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  else if (err instanceof multer.MulterError)
    e = new AppError('INVALID_IMAGE', err.code === 'LIMIT_FILE_SIZE' ? 'That photo is too large (max 10 MB).' : err.message);
  else {
    console.error('[error]', err);
    e = new AppError('INTERNAL', 'Something went wrong on our side.');
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message } } satisfies ApiError);
};
