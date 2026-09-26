import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import { CollectionService } from '../services/CollectionService';
import { ProfileService } from '../services/ProfileService';
import { UserService } from '../services/UserService';
import { AppError } from '../utils/AppError';

async function resolveUser(req: Request) {
  const id = String(req.params.id);
  const user = id === 'me' ? currentUser(req) : await UserService.getById(id);
  if (!user) throw new AppError('NOT_FOUND', 'Student not found.');
  return user;
}

// Only these fields are player-editable; strict() rejects attempts to set anything else (xp, ownerId, …).
const copyPatch = z
  .object({ tradable: z.boolean().optional(), favorite: z.boolean().optional() })
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'nothing to update');

export const userController = {
  async collection(req: Request, res: Response) {
    const user = await resolveUser(req);
    res.json(await CollectionService.getCollection(String(user._id), user.campusId));
  },

  async profile(req: Request, res: Response) {
    const user = await resolveUser(req);
    res.json(await ProfileService.build(user, String(currentUser(req)._id)));
  },

  async updateCopy(req: Request, res: Response) {
    const patch = copyPatch.parse(req.body);
    res.json(await CollectionService.updateCopy(currentUser(req)._id, String(req.params.copyId), patch));
  },
};
