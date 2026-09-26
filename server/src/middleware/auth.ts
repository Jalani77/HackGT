import type { NextFunction, Request, Response } from 'express';
import type { UserDoc } from '../models/User';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { AppError } from '../utils/AppError';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

/** Requires a valid Bearer token; attaches the user document as req.user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('UNAUTHORIZED', 'Please log in.');
  const payload = AuthService.verify(token);
  const user = await UserService.getById(payload.sub);
  if (!user) throw new AppError('UNAUTHORIZED', 'Account not found. Please log in again.');
  req.user = user;
  next();
}

/** Narrow req.user after requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Please log in.');
  return req.user;
}
