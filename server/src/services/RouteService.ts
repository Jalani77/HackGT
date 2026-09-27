import { Types } from 'mongoose';
import type {
  CardCategory,
  CreateRouteRequest,
  RouteCheckpointDTO,
  RouteDifficulty,
  RouteDTO,
  RouteRunDTO,
} from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { xpConfig } from '../config/xp.config';
import { Card } from '../models/Card';
import { Discovery } from '../models/Discovery';
import { Route, RouteRun, type RouteDoc, type RouteRunDoc } from '../models/Route';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { GrantService } from './GrantService';
import type { Activity, ProgressCollector } from './ProgressCollector';
import { cardMinis } from './SocialService';
import { UserService } from './UserService';
import { XPService } from './XPService';

const cfg = communityConfig.routes;
const isDuplicateKeyError = (e: unknown) => (e as { code?: number })?.code === 11000;

type Checkpoint = RouteDoc['checkpoints'][number];

/** A checkpoint is satisfied by its specific card, any card in its category, or (neither) anything. */
function checkpointHit(cp: Checkpoint, a: Extract<Activity, { type: 'discovery' }>): boolean {
  if (cp.cardId) return String(cp.cardId) === String(a.cardId);
  if (cp.category) return cp.category === a.category;
  return true;
}

function difficultyOf(route: Pick<RouteDoc, 'checkpoints' | 'distanceM'>): RouteDifficulty {
  const specific = route.checkpoints.filter((c) => c.cardId).length;
  const score = route.checkpoints.length + specific + (route.distanceM ?? 0) / 800;
  return score <= 4 ? 'easy' : score <= 8 ? 'moderate' : 'hard';
}

export const RouteService = {
  async list(user: UserDoc): Promise<RouteDTO[]> {
    const routes = await Route.find({ campusId: user.campusId, active: true })
      .sort({ official: -1, 'stats.completions': -1, createdAt: -1 })
      .limit(50);
    return this.toDTOs(routes, user._id);
  },

  async get(user: UserDoc, id: string): Promise<RouteDTO> {
    const route = await this.find(user, id);
    return (await this.toDTOs([route], user._id))[0];
  },

  async find(user: UserDoc, id: string): Promise<RouteDoc> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND', 'Route not found.');
    const route = await Route.findOne({ _id: id, campusId: user.campusId, active: true });
    if (!route) throw new AppError('NOT_FOUND', 'Route not found.');
    return route;
  },

  /**
   * Publish a route. Specific-card checkpoints must be things the creator has actually
   * discovered: a route is a trail you've walked, not a wish list. Student routes pay XP only.
   */
  async create(user: UserDoc, req: CreateRouteRequest): Promise<RouteDTO> {
    if (XPService.levelFor(user.xp).level < cfg.createMinLevel) {
      throw new AppError('FORBIDDEN', `Reach level ${cfg.createMinLevel} to publish routes.`);
    }
    if (req.checkpoints.length < cfg.checkpoints.min || req.checkpoints.length > cfg.checkpoints.max) {
      throw new AppError('VALIDATION', `Routes need ${cfg.checkpoints.min}–${cfg.checkpoints.max} checkpoints.`);
    }
    const created = await Route.countDocuments({ creatorId: user._id, active: true });
    if (created >= cfg.maxCreatedPerUser) throw new AppError('CONFLICT', `You've published ${created} routes already.`);

    const cardIds = req.checkpoints.map((c) => c.cardId).filter(Boolean) as string[];
    if (new Set(cardIds).size !== cardIds.length) {
      throw new AppError('VALIDATION', 'Each specific card can only appear once in a route.');
    }
    if (cardIds.some((id) => !Types.ObjectId.isValid(id))) throw new AppError('VALIDATION', 'Invalid checkpoint card.');
    const ids = cardIds.map((id) => new Types.ObjectId(id));
    const [valid, discovered] = await Promise.all([
      Card.countDocuments({ _id: { $in: ids }, campusId: user.campusId, source: 'discovery' }),
      Discovery.distinct('cardId', { userId: user._id, cardId: { $in: ids } }),
    ]);
    if (valid !== ids.length) throw new AppError('VALIDATION', 'Checkpoints can only use cards found by photographing things.');
    if (discovered.length !== ids.length) {
      throw new AppError('VALIDATION', "You can only add specific cards you've discovered yourself. Use a category instead.");
    }

    const route = await Route.create({
      campusId: user.campusId,
      creatorId: user._id,
      official: false,
      title: req.title,
      description: req.description ?? '',
      checkpoints: req.checkpoints.map((c, i) => ({
        order: i,
        label: c.label,
        hint: c.hint ?? '',
        area: c.area ?? '',
        cardId: c.cardId ? new Types.ObjectId(c.cardId) : null,
        category: c.cardId ? null : (c.category ?? null),
      })),
      distanceM: req.distanceM ?? null,
      estMinutes: req.estMinutes ?? null,
      reward: { xp: xpConfig.routeComplete, cardId: null },
    });
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.routesCreated': 1 } });
    return (await this.toDTOs([route], user._id))[0];
  },

  async start(user: UserDoc, id: string): Promise<RouteDTO> {
    const route = await this.find(user, id);
    const active = await RouteRun.countDocuments({ userId: user._id, status: 'active' });
    if (active >= cfg.maxActiveRuns) {
      throw new AppError('CONFLICT', `You're already following ${active} routes. Finish or drop one first.`);
    }
    try {
      await RouteRun.create({ userId: user._id, routeId: route._id });
    } catch (e) {
      if (!isDuplicateKeyError(e)) throw e;
      throw new AppError('CONFLICT', "You're already on this route.");
    }
    await Route.updateOne({ _id: route._id }, { $inc: { 'stats.starts': 1 } });
    return this.get(user, id);
  },

  async abandon(user: UserDoc, id: string): Promise<RouteDTO> {
    const route = await this.find(user, id);
    await RouteRun.updateOne({ userId: user._id, routeId: route._id, status: 'active' }, { $set: { status: 'abandoned' } });
    return this.get(user, id);
  },

  /**
   * Advance every route this student is following whose *next* checkpoint this discovery
   * satisfies. Conditional on nextIndex, so a discovery advances each run at most once.
   */
  async onDiscovery(userId: Types.ObjectId, a: Extract<Activity, { type: 'discovery' }>, out: ProgressCollector) {
    const runs = await RouteRun.find({ userId, status: 'active' });
    if (!runs.length) return;
    const routes = new Map((await Route.find({ _id: { $in: runs.map((r) => r.routeId) } })).map((r) => [String(r._id), r]));

    for (const run of runs) {
      const route = routes.get(String(run.routeId));
      const cp = route?.checkpoints[run.nextIndex];
      if (!route || !cp || !checkpointHit(cp, a)) continue;
      // Generic checkpoints need a different find each time ("3 plants" ≠ one plant three times).
      if (run.hits.some((h) => String(h.cardId) === String(a.cardId))) continue;

      const advanced = await RouteRun.findOneAndUpdate(
        { _id: run._id, status: 'active', nextIndex: run.nextIndex },
        { $inc: { nextIndex: 1 }, $push: { hits: { order: cp.order, discoveryId: a.discoveryId, cardId: a.cardId, at: a.at } } },
        { returnDocument: 'after' },
      );
      if (!advanced) continue;

      const total = route.checkpoints.length;
      const finished = advanced.nextIndex >= total && (await this.complete(userId, route, advanced, out));
      out.route({
        routeId: String(route._id),
        title: route.title,
        checkpoint: cp.label,
        done: Math.min(advanced.nextIndex, total),
        total,
        completed: finished,
      });
    }
  },

  /** Finish a run. The reward pays out on a student's first completion of each route only. */
  async complete(userId: Types.ObjectId, route: RouteDoc, run: RouteRunDoc, out: ProgressCollector): Promise<boolean> {
    const claim = await RouteRun.updateOne(
      { _id: run._id, status: 'active' },
      { $set: { status: 'completed', completedAt: new Date() } },
    );
    if (claim.modifiedCount !== 1) return false;

    const earlier = await RouteRun.exists({ userId, routeId: route._id, status: 'completed', _id: { $ne: run._id } });
    if (earlier) return true; // replaying a favorite route is fine, it just doesn't pay again

    await Promise.all([
      Route.updateOne({ _id: route._id }, { $inc: { 'stats.completions': 1 } }),
      User.updateOne({ _id: userId }, { $inc: { 'stats.routesCompleted': 1 } }),
    ]);
    out.reward(
      await GrantService.grant(userId, {
        source: 'route',
        sourceId: route._id,
        title: route.title,
        headline: 'ROUTE COMPLETE!',
        xp: route.reward?.xp ?? 0,
        cardId: route.reward?.cardId ?? null,
        via: 'reward',
      }),
    );
    // Creators earn a little every time someone else explores their route.
    if (route.creatorId && String(route.creatorId) !== String(userId)) {
      await XPService.award(route.creatorId, xpConfig.routeCreatorBonus);
    }
    out.followUp({ type: 'route_completed', key: `route:${route._id}`, routeId: route._id });
    return true;
  },

  async toDTOs(routes: RouteDoc[], viewerId: Types.ObjectId): Promise<RouteDTO[]> {
    if (!routes.length) return [];
    const routeIds = routes.map((r) => r._id);
    const cardIds = routes.flatMap((r) => [...r.checkpoints.map((c) => c.cardId), r.reward?.cardId]).filter(Boolean);
    const [creators, minis, runs, completed] = await Promise.all([
      User.find({ _id: { $in: routes.map((r) => r.creatorId).filter(Boolean) } }).select('username displayName xp'),
      cardMinis(cardIds as Types.ObjectId[]),
      RouteRun.find({ userId: viewerId, routeId: { $in: routeIds } }).sort({ startedAt: -1 }),
      RouteRun.distinct('routeId', { userId: viewerId, routeId: { $in: routeIds }, status: 'completed' }),
    ]);
    const creatorMap = new Map(creators.map((u) => [String(u._id), UserService.toSummary(u)]));
    const doneSet = new Set(completed.map(String));
    // Most relevant run per route: the active one, else the latest.
    const runFor = (routeId: string): RouteRunDTO | null => {
      const mine = runs.filter((r) => String(r.routeId) === routeId);
      const r = mine.find((x) => x.status === 'active') ?? mine[0];
      if (!r) return null;
      return {
        id: String(r._id),
        status: r.status as RouteRunDTO['status'],
        done: r.nextIndex,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      };
    };

    return routes.map((r) => ({
      id: String(r._id),
      title: r.title,
      description: r.description,
      creator: r.creatorId ? (creatorMap.get(String(r.creatorId)) ?? null) : null,
      official: r.official,
      checkpoints: r.checkpoints.map(
        (c): RouteCheckpointDTO => ({
          order: c.order,
          label: c.label,
          hint: c.hint,
          area: c.area,
          card: c.cardId ? (minis.get(String(c.cardId)) ?? null) : null,
          category: (c.category as CardCategory | null) ?? null,
        }),
      ),
      distanceM: r.distanceM ?? null,
      estMinutes: r.estMinutes ?? null,
      difficulty: difficultyOf(r),
      reward: { xp: r.reward?.xp ?? 0, card: r.reward?.cardId ? (minis.get(String(r.reward.cardId)) ?? null) : null },
      stats: { starts: r.stats?.starts ?? 0, completions: r.stats?.completions ?? 0 },
      myRun: runFor(String(r._id)),
      completedByMe: doneSet.has(String(r._id)),
      createdAt: r.createdAt.toISOString(),
    }));
  },
};
