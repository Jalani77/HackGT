import type { Request, Response } from 'express';
import { z } from 'zod';
import { EVENT_KINDS } from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { currentUser } from '../middleware/auth';
import { AchievementService } from '../services/AchievementService';
import { EventService } from '../services/EventService';
import { MissionService } from '../services/MissionService';
import { ProgressService } from '../services/ProgressService';
import { RewardService } from '../services/RewardService';
import { UserService } from '../services/UserService';
import { AppError } from '../utils/AppError';

const ev = communityConfig.events;
const text = (max: number) => z.string().trim().max(max);

const createEvent = z
  .object({
    title: text(60).min(3),
    description: text(400).optional(),
    kind: z.enum(EVENT_KINDS),
    locationName: text(80).min(2),
    hostLabel: text(40).optional(),
    startsAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().min(15).max(ev.maxDurationMinutes),
    minParticipants: z.number().int().min(ev.minParticipants.min).max(ev.minParticipants.max),
    maxParticipants: z.number().int().min(2).max(500).nullable().optional(),
    requiredDiscoveries: z.number().int().min(0).max(10).optional(),
  })
  .strict();

const checkIn = z.object({ code: z.string().trim().min(3).max(12) }).strict();

export const communityController = {
  // Missions
  async missions(req: Request, res: Response) {
    res.json(await MissionService.list(currentUser(req)));
  },
  async joinMission(req: Request, res: Response) {
    res.json(await MissionService.join(currentUser(req), String(req.params.id)));
  },
  async leaveMission(req: Request, res: Response) {
    await MissionService.leave(currentUser(req), String(req.params.id));
    res.json({ ok: true });
  },

  // Events
  async events(req: Request, res: Response) {
    res.json(await EventService.list(currentUser(req)));
  },
  async event(req: Request, res: Response) {
    res.json(await EventService.get(currentUser(req), String(req.params.id)));
  },
  async createEvent(req: Request, res: Response) {
    res.status(201).json(await EventService.create(currentUser(req), createEvent.parse(req.body)));
  },
  async joinEvent(req: Request, res: Response) {
    res.json(await EventService.join(currentUser(req), String(req.params.id)));
  },
  async leaveEvent(req: Request, res: Response) {
    res.json(await EventService.leave(currentUser(req), String(req.params.id)));
  },
  async checkIn(req: Request, res: Response) {
    const user = currentUser(req);
    const { code } = checkIn.parse(req.body);
    const { event, rewards } = await EventService.checkIn(user, String(req.params.id), code);
    const progress = await ProgressService.afterEventRewards(user._id, rewards);
    // Re-read so the DTO reflects rewards just paid out.
    const fresh = rewards.length ? await EventService.get(user, event.id) : event;
    res.json(await ProgressService.result(user, fresh, progress));
  },

  // Rewards
  async rewards(req: Request, res: Response) {
    res.json(await RewardService.list(currentUser(req)));
  },
  async redeem(req: Request, res: Response) {
    const user = currentUser(req);
    const result = await RewardService.redeem(user, String(req.params.id));
    // Collectible cards count toward achievements (e.g. "own an Epic card").
    const progress = await ProgressService.safeRun(user._id, []);
    if (result.grant) progress.rewards.unshift(result.grant);
    res.json(await ProgressService.result(user, result, progress));
  },

  // Achievements
  async achievements(req: Request, res: Response) {
    const id = String(req.params.id);
    const user = id === 'me' ? currentUser(req) : await UserService.getById(id);
    if (!user) throw new AppError('NOT_FOUND', 'Student not found.');
    res.json(await AchievementService.list(user._id));
  },
};
