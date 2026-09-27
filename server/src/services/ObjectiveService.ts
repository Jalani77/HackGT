import type { Types } from 'mongoose';
import type { ObjectiveDTO } from '../../../shared/types';
import { CampusEvent } from '../models/Event';
import { Mission, MissionProgress } from '../models/Mission';
import { Route, RouteRun } from '../models/Route';

/**
 * The single "what should I do next?" shown on the camera HUD. Priority:
 * a live event you're checked in to → the route you're following → your closest mission.
 */
export const ObjectiveService = {
  async current(userId: Types.ObjectId): Promise<ObjectiveDTO | null> {
    const now = new Date();

    const event = await CampusEvent.findOne({
      participants: { $elemMatch: { userId, checkedInAt: { $ne: null }, rewardedAt: null } },
      startsAt: { $lte: now },
      endsAt: { $gt: now },
    }).lean();
    if (event) {
      const checkedIn = event.participants.filter((p) => p.checkedInAt).length;
      const waiting = checkedIn < event.minParticipants;
      return {
        kind: 'event',
        id: String(event._id),
        icon: '🎪',
        label: waiting
          ? `${event.title}: waiting for ${event.minParticipants - checkedIn} more to check in`
          : `${event.title}: discover things together!`,
        progress: waiting ? checkedIn : 0,
        target: waiting ? event.minParticipants : event.requiredDiscoveries,
      };
    }

    const run = await RouteRun.findOne({ userId, status: 'active' }).sort({ updatedAt: -1 }).lean();
    const route = run && (await Route.findById(run.routeId).lean());
    const cp = route?.checkpoints[run!.nextIndex];
    if (route && cp) {
      return {
        kind: 'route',
        id: String(route._id),
        icon: '🥾',
        label: `${route.title} → ${cp.label}`,
        progress: run!.nextIndex,
        target: route.checkpoints.length,
      };
    }

    const progress = await MissionProgress.find({ userId, status: 'active' }).lean();
    if (!progress.length) return null;
    const missions = await Mission.find({ _id: { $in: progress.map((p) => p.missionId) }, active: true }).lean();
    const best = progress
      .map((p) => ({ p, m: missions.find((m) => String(m._id) === String(p.missionId)) }))
      .filter((x) => x.m && (!x.m.endsAt || x.m.endsAt > now))
      .sort((a, b) => b.p.progress / b.m!.requirements!.count - a.p.progress / a.m!.requirements!.count)[0];
    if (!best) return null;
    return {
      kind: 'mission',
      id: String(best.m!._id),
      icon: best.m!.icon,
      label: best.m!.title,
      progress: best.p.progress,
      target: best.m!.requirements!.count,
    };
  },
};
