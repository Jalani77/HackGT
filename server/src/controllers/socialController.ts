import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import { SocialService } from '../services/SocialService';
import { TradeService } from '../services/TradeService';
import { UserService } from '../services/UserService';
import { WishlistService } from '../services/WishlistService';
import { AppError } from '../utils/AppError';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

const createTrade = z
  .object({
    toUserId: objectId,
    offeredCopyIds: z.array(objectId).max(5),
    requestedCopyIds: z.array(objectId).max(5),
    message: z.string().max(200).optional(),
  })
  .strict();

const tradeStatus = z.enum(['pending', 'processing', 'accepted', 'declined', 'cancelled', 'expired']).optional();

export const socialController = {
  // Wishlist
  async addToWishlist(req: Request, res: Response) {
    const { cardId } = z.object({ cardId: objectId }).parse(req.body);
    await WishlistService.add(currentUser(req), cardId);
    res.status(201).json({ ok: true });
  },
  async removeFromWishlist(req: Request, res: Response) {
    await WishlistService.remove(currentUser(req)._id, String(req.params.cardId));
    res.json({ ok: true });
  },
  async wishlist(req: Request, res: Response) {
    const viewer = currentUser(req);
    const id = String(req.params.id);
    const owner = id === 'me' ? viewer : await UserService.getById(id);
    if (!owner) throw new AppError('NOT_FOUND', 'Student not found.');
    res.json(await WishlistService.get(owner, viewer._id));
  },

  // Discovery of other students
  async students(req: Request, res: Response) {
    const q = z.string().trim().max(24).optional().parse(req.query.q);
    res.json(await SocialService.students(currentUser(req), q));
  },
  async cardSocial(req: Request, res: Response) {
    res.json(await SocialService.cardSocial(currentUser(req), String(req.params.id)));
  },

  // Trades
  async listTrades(req: Request, res: Response) {
    res.json(await TradeService.list(currentUser(req), tradeStatus.parse(req.query.status)));
  },
  async createTrade(req: Request, res: Response) {
    res.status(201).json(await TradeService.create(currentUser(req), createTrade.parse(req.body)));
  },
  async acceptTrade(req: Request, res: Response) {
    res.json(await TradeService.accept(currentUser(req), String(req.params.id)));
  },
  async rejectTrade(req: Request, res: Response) {
    res.json(await TradeService.decline(currentUser(req), String(req.params.id)));
  },
  async cancelTrade(req: Request, res: Response) {
    res.json(await TradeService.cancel(currentUser(req), String(req.params.id)));
  },
};
