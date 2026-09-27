import type { Types } from 'mongoose';
import type { ActionResult, ProgressUpdate } from '../../../shared/types';
import { User, type UserDoc } from '../models/User';
import { AchievementService } from './AchievementService';
import { EventService, type EventReward } from './EventService';
import { MissionService } from './MissionService';
import { ProgressCollector, type Activity } from './ProgressCollector';
import { RouteService } from './RouteService';
import { UnlockService } from './UnlockService';
import { UserService } from './UserService';

/**
 * The activity bus. Discoveries, trades, event attendance, and route completions flow through
 * here, and every system that cares (missions, routes, events, achievements) reacts to them.
 * Follow-up activities (e.g. finishing a route) are processed in the same pass.
 */
export const ProgressService = {
  async run(userId: Types.ObjectId, activities: Activity[], out = new ProgressCollector()): Promise<ProgressUpdate> {
    const queue = [...activities];
    for (let guard = 0; queue.length && guard < 25; guard++) {
      const a = queue.shift()!;
      await MissionService.record(userId, a, out);
      if (a.type === 'discovery') {
        await RouteService.onDiscovery(userId, a, out);
        await EventService.onDiscovery(userId, a, out);
      }
      queue.push(...out.drainFollowUps());
    }
    await AchievementService.check(userId, out);
    return out.toUpdate();
  },

  /**
   * Same as run, but never throws. Progress is a side effect: a failure here must not undo
   * or fail the discovery/trade that triggered it (that has already been committed).
   */
  async safeRun(userId: Types.ObjectId, activities: Activity[], out = new ProgressCollector()): Promise<ProgressUpdate> {
    try {
      return await this.run(userId, activities, out);
    } catch (err) {
      console.error('[progress] failed to record progress:', err);
      return out.toUpdate(); // whatever was recorded before the failure
    }
  },

  /**
   * Distribute group-event payouts. The acting student's rewards come back in the response;
   * everyone else in the group has their missions/achievements updated quietly.
   */
  async afterEventRewards(actingUserId: Types.ObjectId, rewards: EventReward[]): Promise<ProgressUpdate> {
    const mine = new ProgressCollector();
    for (const r of rewards) {
      const attended: Activity = { type: 'event_attended', key: `event:${r.eventId}`, eventId: r.eventId };
      if (String(r.userId) === String(actingUserId)) {
        mine.reward(r.grant);
        mine.followUp(attended);
      } else {
        await this.safeRun(r.userId, [attended]);
      }
    }
    return this.safeRun(actingUserId, mine.drainFollowUps(), mine);
  },

  /** Wrap an action's result with its progress, any level-up, and fresh player state. */
  async result<T>(user: UserDoc, data: T, progress: ProgressUpdate): Promise<ActionResult<T>> {
    const fresh = (await User.findById(user._id))!;
    return {
      data,
      progress,
      levelUp: await UnlockService.levelUp(user.campusId, user.xp, fresh.xp),
      player: await UserService.toPublic(fresh, { isSelf: true }),
    };
  },
};
