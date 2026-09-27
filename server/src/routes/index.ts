import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { cardController } from '../controllers/cardController';
import { communityController } from '../controllers/communityController';
import { routeController } from '../controllers/routeController';
import { discoveryController } from '../controllers/discoveryController';
import { socialController } from '../controllers/socialController';
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

// Player-controlled flags on your own copies (favorite, tradable)
api.patch('/collection/:copyId', requireAuth, userController.updateCopy);

// Wishlist
api.post('/wishlist', requireAuth, socialController.addToWishlist);
api.delete('/wishlist/:cardId', requireAuth, socialController.removeFromWishlist);
api.get('/users/:id/wishlist', requireAuth, socialController.wishlist);

// Social discovery
api.get('/students', requireAuth, socialController.students);
api.get('/cards/:id/social', requireAuth, socialController.cardSocial);

// Trading (all ownership checks are server-side in TradeService)
api.get('/trades', requireAuth, socialController.listTrades);
api.post('/trades', requireAuth, rateLimited(20, 'Too many trade offers. Take a breather!'), socialController.createTrade);
api.post('/trades/:id/accept', requireAuth, socialController.acceptTrade);
api.post('/trades/:id/reject', requireAuth, socialController.rejectTrade);
api.post('/trades/:id/cancel', requireAuth, socialController.cancelTrade);

// Missions (definitions live in MongoDB; progress is only advanced server-side by real activity)
api.get('/missions', requireAuth, communityController.missions);
api.post('/missions/:id/join', requireAuth, communityController.joinMission);
api.post('/missions/:id/leave', requireAuth, communityController.leaveMission);

// Group events
api.get('/events', requireAuth, communityController.events);
api.post('/events', requireAuth, rateLimited(10, 'Too many events created. Try again in a minute.'), communityController.createEvent);
api.get('/events/:id', requireAuth, communityController.event);
api.post('/events/:id/join', requireAuth, communityController.joinEvent);
api.post('/events/:id/leave', requireAuth, communityController.leaveEvent);
// Rate-limited so check-in codes can't be brute-forced.
api.post('/events/:id/checkin', requireAuth, rateLimited(10, 'Too many check-in attempts. Wait a minute.'), communityController.checkIn);

// Rewards / student deals, and achievements
api.get('/rewards', requireAuth, communityController.rewards);
api.post('/rewards/:id/redeem', requireAuth, communityController.redeem);
api.get('/users/:id/achievements', requireAuth, communityController.achievements);

// Exploration routes (Phase 5)
api.get('/routes', requireAuth, routeController.list);
api.post('/routes', requireAuth, rateLimited(10, 'Too many routes created. Try again in a minute.'), routeController.create);
api.get('/routes/:id', requireAuth, routeController.get);
api.post('/routes/:id/start', requireAuth, routeController.start);
api.post('/routes/:id/abandon', requireAuth, routeController.abandon);
