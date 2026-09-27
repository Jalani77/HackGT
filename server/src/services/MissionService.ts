import { Types } from 'mongoose';
import { rarityRank, type Rarity } from '../../../shared/rarity';
import type { MissionDTO, MissionRequirements, MissionStatus } from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { Mission, MissionProgress, type MissionDoc, type MissionProgressDoc } from '../models/Mission';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { GrantService } from './GrantService';
import type { Activity, ProgressCollector } from './ProgressCollector';
import { cardMinis } from './SocialService';
import { XPService } from './XPService';

/** Missions that are live right now (active flag + optional start/end window). */
function liveFilter(campusId: string, now = new Date()) {
  return {
    campusId,
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  };
}

function requirementsOf(m: MissionDoc): MissionRequirements {
  const r = m.requirements!;
  return {
    objective: r.objective as MissionRequirements['objective'],
    count: r.count,
    category: (r.category as MissionRequirements['category']) ?? null,
    minRarity: (r.minRarity as Rarity | null) ?? null,
    landmarkOnly: !!r.landmarkOnly,
    newCardsOnly: !!r.newCardsOnly,
    distinct: !!r.distinct,
  };
}

/** Does this activity count toward this mission? Pure interpretation of the mission's data. */
export function activityMatches(req: MissionRequirements, a: Activity): boolean {
  switch (req.objective) {
    case 'discover':
      if (a.type !== 'discovery') return false;
      if (req.category && a.category !== req.category) return false;
      if (req.minRarity && rarityRank(a.rarity) < rarityRank(req.minRarity)) return false;
      if (req.landmarkOnly && !a.isLandmark) return false;
      if (req.newCardsOnly && !a.isNewCard) return false;
      return true;
    case 'trade':
      return a.type === 'trade';
    case 'attend_event':
      return a.type === 'event_attended';
    case 'complete_route':
      return a.type === 'route_completed';
  }
}

/** Key that makes counting idempotent: per card for "different" missions, per activity otherwise. */
const countKey = (req: MissionRequirements, a: Activity) =>
  req.distinct && a.type === 'discovery' ? `card:${a.cardId}` : a.key;

export const MissionService = {
  async list(user: UserDoc): Promise<MissionDTO[]> {
    const missions = await Mission.find(liveFilter(user.campusId)).sort({ sortOrder: 1, minLevel: 1 });
    const progress = await MissionProgress.find({ userId: user._id, missionId: { $in: missions.map((m) => m._id) } });
    return this.toDTOs(missions, progress, XPService.levelFor(user.xp).level);
  },

  async join(user: UserDoc, missionId: string): Promise<MissionDTO> {
    if (!Types.ObjectId.isValid(missionId)) throw new AppError('NOT_FOUND', 'Mission not found.');
    const mission = await Mission.findOne({ _id: missionId, ...liveFilter(user.campusId) });
    if (!mission) throw new AppError('NOT_FOUND', 'Mission not found or no longer running.');
    const level = XPService.levelFor(user.xp).level;
    if (level < mission.minLevel) throw new AppError('FORBIDDEN', `Reach level ${mission.minLevel} to unlock this mission.`);

    const existing = await MissionProgress.findOne({ userId: user._id, missionId: mission._id });
    if (!existing) {
      const active = await MissionProgress.countDocuments({ userId: user._id, status: 'active' });
      if (active >= communityConfig.missions.maxActive) {
        throw new AppError('CONFLICT', `You already have ${active} missions in progress. Finish or drop one first.`);
      }
      await MissionProgress.updateOne(
        { userId: user._id, missionId: mission._id },
        { $setOnInsert: { userId: user._id, missionId: mission._id, joinedAt: new Date() } },
        { upsert: true },
      );
    }
    const progress = await MissionProgress.find({ userId: user._id, missionId: mission._id });
    return (await this.toDTOs([mission], progress, level))[0];
  },

  /** Drop an in-progress mission (progress is discarded; completed missions stay completed). */
  async leave(user: UserDoc, missionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(missionId)) return;
    await MissionProgress.deleteOne({ userId: user._id, missionId, status: 'active' });
  },

  /**
   * Advance every joined mission this activity counts toward. Each step is a conditional
   * update, so retries and concurrent requests can't double-count or double-reward.
   */
  async record(userId: Types.ObjectId, a: Activity, out: ProgressCollector): Promise<void> {
    const active = await MissionProgress.find({ userId, status: 'active' });
    if (!active.length) return;
    const missions = new Map(
      (await Mission.find({ _id: { $in: active.map((p) => p.missionId) } })).map((m) => [String(m._id), m]),
    );
    const now = new Date();

    for (const p of active) {
      const m = missions.get(String(p.missionId));
      if (!m || !m.active || (m.endsAt && m.endsAt <= now)) continue;
      const req = requirementsOf(m);
      if (!activityMatches(req, a)) continue;

      const key = countKey(req, a);
      const updated = await MissionProgress.findOneAndUpdate(
        { _id: p._id, status: 'active', counted: { $ne: key } },
        { $push: { counted: key }, $inc: { progress: 1 } },
        { returnDocument: 'after' },
      );
      if (!updated) continue; // already counted

      let completed = false;
      if (updated.progress >= req.count) {
        const claim = await MissionProgress.updateOne(
          { _id: p._id, status: 'active' },
          { $set: { status: 'completed', completedAt: now } },
        );
        if (claim.modifiedCount === 1) {
          completed = true;
          await User.updateOne({ _id: userId }, { $inc: { 'stats.missionsCompleted': 1 } });
          out.reward(
            await GrantService.grant(userId, {
              source: 'mission',
              sourceId: m._id,
              title: m.title,
              headline: 'MISSION COMPLETE!',
              xp: m.reward?.xp ?? 0,
              cardId: m.reward?.cardId ?? null,
              via: 'reward',
            }),
          );
        }
      }
      out.mission({
        missionId: String(m._id),
        title: m.title,
        icon: m.icon,
        progress: Math.min(updated.progress, req.count),
        target: req.count,
        completed,
      });
    }
  },

  async toDTOs(missions: MissionDoc[], progress: MissionProgressDoc[], level: number): Promise<MissionDTO[]> {
    const byMission = new Map(progress.map((p) => [String(p.missionId), p]));
    const minis = await cardMinis(missions.map((m) => m.reward?.cardId).filter(Boolean) as Types.ObjectId[]);
    return missions.map((m) => {
      const p = byMission.get(String(m._id));
      const req = requirementsOf(m);
      const status: MissionStatus =
        p?.status === 'completed' ? 'completed' : p ? 'active' : level < m.minLevel ? 'locked' : 'available';
      return {
        id: String(m._id),
        title: m.title,
        description: m.description,
        icon: m.icon,
        requirements: req,
        minLevel: m.minLevel,
        reward: { xp: m.reward?.xp ?? 0, card: m.reward?.cardId ? (minis.get(String(m.reward.cardId)) ?? null) : null },
        endsAt: m.endsAt ? m.endsAt.toISOString() : null,
        status,
        progress: Math.min(p?.progress ?? 0, req.count),
        completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
      };
    });
  },
};
