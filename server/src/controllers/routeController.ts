import type { Request, Response } from 'express';
import { z } from 'zod';
import { CARD_CATEGORIES } from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { currentUser } from '../middleware/auth';
import { ProgressService } from '../services/ProgressService';
import { RouteService } from '../services/RouteService';

const cp = communityConfig.routes.checkpoints;
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

const createRoute = z
  .object({
    title: z.string().trim().min(3).max(50),
    description: z.string().trim().max(300).optional(),
    checkpoints: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(40),
            hint: z.string().trim().max(120).optional(),
            area: z.string().trim().max(40).optional(),
            cardId: objectId.nullable().optional(),
            category: z.enum(CARD_CATEGORIES).nullable().optional(),
          })
          .strict(),
      )
      .min(cp.min)
      .max(cp.max),
    distanceM: z.number().int().min(0).max(50_000).nullable().optional(),
    estMinutes: z.number().int().min(1).max(600).nullable().optional(),
  })
  .strict();

export const routeController = {
  async list(req: Request, res: Response) {
    res.json(await RouteService.list(currentUser(req)));
  },
  async get(req: Request, res: Response) {
    res.json(await RouteService.get(currentUser(req), String(req.params.id)));
  },
  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const route = await RouteService.create(user, createRoute.parse(req.body));
    const progress = await ProgressService.safeRun(user._id, []); // "Trailblazer" achievement
    res.status(201).json(await ProgressService.result(user, route, progress));
  },
  async start(req: Request, res: Response) {
    res.json(await RouteService.start(currentUser(req), String(req.params.id)));
  },
  async abandon(req: Request, res: Response) {
    res.json(await RouteService.abandon(currentUser(req), String(req.params.id)));
  },
};
