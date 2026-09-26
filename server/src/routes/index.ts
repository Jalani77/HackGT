import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { cardController } from '../controllers/cardController';
import { discoveryController } from '../controllers/discoveryController';
import { userController } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';
import { imageUpload } from '../middleware/upload';

const rateLimited = (limit: number, message: string) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
  });

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Auth
api.post('/auth/register', rateLimited(20, 'Too many attempts. Try again in a minute.'), authController.register);
api.post('/auth/login', rateLimited(20, 'Too many attempts. Try again in a minute.'), authController.login);
api.get('/auth/me', requireAuth, authController.me);

// Discovery pipeline (AI calls cost money → rate limited per IP)
api.post(
  '/discoveries/analyze',
  requireAuth,
  rateLimited(15, 'Whoa, slow down explorer! Try again in a minute.'),
  imageUpload.single('image'),
  discoveryController.analyze,
);
api.get('/discoveries/mine', requireAuth, discoveryController.mine);

// Catalog (read-only for players — cards are only minted by the discovery pipeline)
api.get('/cards', requireAuth, cardController.list);
api.get('/cards/:id', requireAuth, cardController.get);

// Users
api.get('/users/:id/collection', requireAuth, userController.collection);
api.get('/users/:id/profile', requireAuth, userController.profile);
