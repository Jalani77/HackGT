import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth';
import { CollectionService } from '../services/CollectionService';
import { UserService } from '../services/UserService';
import { AppError } from '../utils/AppError';

async function resolveUser(req: Request) {
  const id = String(req.params.id);
  const user = id === 'me' ? currentUser(req) : await UserService.getById(id);
  if (!user) throw new AppError('NOT_FOUND', 'Student not found.');
  return user;
}

export const userController = {
  async collection(req: Request, res: Response) {
    const user = await resolveUser(req);
    res.json(await CollectionService.getCollection(String(user._id), user.campusId));
  },

  async profile(req: Request, res: Response) {
    res.json(await UserService.toPublic(await resolveUser(req)));
  },
};
