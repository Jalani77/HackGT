import type { LevelUpDTO } from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { CampusEvent } from '../models/Event';
import { Mission } from '../models/Mission';
import { Reward } from '../models/Reward';
import { XPService } from './XPService';

/** Features gated by level in config (not stored as documents). */
const FEATURES = [
  { level: communityConfig.events.hostMinLevel, label: '📣 Host your own group events' },
  { level: communityConfig.routes.createMinLevel, label: '🗺️ Publish exploration routes' },
];

/** "Higher levels unlock…": describes what a level-up opened, from real mission/event/reward data. */
export const UnlockService = {
  async levelUp(campusId: string, xpBefore: number, xpAfter: number): Promise<LevelUpDTO | null> {
    const from = XPService.levelFor(xpBefore).level;
    const to = XPService.levelFor(xpAfter);
    if (to.level <= from) return null;

    const range = { $gt: from, $lte: to.level };
    const [missions, events, rewards] = await Promise.all([
      Mission.find({ campusId, active: true, minLevel: range }).select('title icon').lean(),
      CampusEvent.find({ campusId, minLevel: range, endsAt: { $gt: new Date() } }).select('title').lean(),
      Reward.find({ campusId, active: true, minLevel: range }).select('title icon').lean(),
    ]);
    return {
      from,
      to: to.level,
      title: to.title,
      unlocks: [
        ...rewards.map((r) => `${r.icon} ${r.title}`),
        ...missions.map((m) => `${m.icon} Mission: ${m.title}`),
        ...events.map((e) => `🎪 Event: ${e.title}`),
        ...FEATURES.filter((f) => f.level > from && f.level <= to.level).map((f) => f.label),
      ],
    };
  },
};
