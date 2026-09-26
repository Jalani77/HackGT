import type { Request, Response } from 'express';
import { z } from 'zod';
import { RARITY_TIERS } from '../../../shared/rarity';
import { CARD_CATEGORIES } from '../../../shared/types';
import { currentUser } from '../middleware/auth';
import { CardService } from '../services/CardService';
import { AppError } from '../utils/AppError';

const listQuery = z.object({
  category: z.enum(CARD_CATEGORIES).optional(),
  rarity: z.enum(RARITY_TIERS).optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const cardController = {
  async list(req: Request, res: Response) {
    const query = listQuery.parse(req.query);
    res.json(await CardService.list({ ...query, campusId: currentUser(req).campusId }));
  },

  async get(req: Request, res: Response) {
    const card = await CardService.getById(String(req.params.id));
    if (!card) throw new AppError('NOT_FOUND', 'Card not found.');
    res.json(card);
  },
};
