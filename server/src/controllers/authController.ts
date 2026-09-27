import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/auth';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'letters, numbers and underscores only'),
  password: z.string().min(6).max(100),
  displayName: z.string().trim().max(40).optional(),
});

export const authController = {
  async register(req: Request, res: Response) {
    res.status(201).json(await AuthService.register(credentials.parse(req.body)));
  },
  async login(req: Request, res: Response) {
    res.json(await AuthService.login(credentials.pick({ username: true, password: true }).parse(req.body)));
  },
  async me(req: Request, res: Response) {
    res.json(await UserService.toPublic(currentUser(req), { isSelf: true }));
  },
};
