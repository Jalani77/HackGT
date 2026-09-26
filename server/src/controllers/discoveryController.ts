import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import { DiscoveryService } from '../services/DiscoveryService';
import { AppError } from '../utils/AppError';

const analyzeBody = z.object({
  clientCaptureId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{8,64}$/, 'invalid capture id'),
});

export const discoveryController = {
  async analyze(req: Request, res: Response) {
    if (!req.file) throw new AppError('INVALID_IMAGE', 'No photo was received. Try again.');
    const { clientCaptureId } = analyzeBody.parse(req.body);
    const result = await DiscoveryService.analyze({ user: currentUser(req), image: req.file.buffer, clientCaptureId });
    res.status(201).json(result);
  },

  async mine(req: Request, res: Response) {
    res.json(await DiscoveryService.listMine(currentUser(req)._id));
  },
};
