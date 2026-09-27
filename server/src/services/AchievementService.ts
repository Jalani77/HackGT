import type { Types } from 'mongoose';
import type { AchievementDTO } from '../../../shared/types';
import { ACHIEVEMENTS, type AchievementDef, type AchievementMetric } from '../config/achievements.config';
import { Card } from '../models/Card';
import { Discovery } from '../models/Discovery';
import { OwnedCard } from '../models/OwnedCard';
import { User } from '../models/User';
import type { ProgressCollector } from './ProgressCollector';
import { XPService } from './XPService';

type Metrics = Record<AchievementMetric, number>;

function toDTO(def: AchievementDef, metrics: Metrics, unlockedAt: Date | null): AchievementDTO {
  return {
    key: def.key,
    title: def.title,
    description: def.description,
    icon: def.icon,
    xp: def.xp,
    progress: Math.min(metrics[def.metric], def.target),
    target: def.target,
    unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
  };
}

export const AchievementService = {
  /** Everything achievements are measured on, computed from real data (never client input). */
  async metrics(userId: Types.ObjectId): Promise<{ metrics: Metrics; unlocked: Map<string, Date> }> {
    const [user, cardIds, categories, firstOnCampus] = await Promise.all([
      User.findById(userId).select('stats achievements').lean(),
      OwnedCard.distinct('cardId', { ownerId: userId }),
      Discovery.distinct('aiAnalysis.category', { userId }),
      Discovery.countDocuments({ userId, isFirstOnCampus: true }),
    ]);
    const epicCards = await Card.countDocuments({ _id: { $in: cardIds }, rarity: { $in: ['EPIC', 'LEGENDARY', 'MYTHIC'] } });
    const s = user?.stats;
    return {
      metrics: {
        discoveries: s?.discoveries ?? 0,
        uniqueCards: cardIds.length,
        categories: categories.filter(Boolean).length,
        firstOnCampus,
        epicCards,
        trades: s?.trades ?? 0,
        missionsCompleted: s?.missionsCompleted ?? 0,
        eventsAttended: s?.eventsAttended ?? 0,
        routesCompleted: s?.routesCompleted ?? 0,
        routesCreated: s?.routesCreated ?? 0,
      },
      unlocked: new Map((user?.achievements ?? []).map((a) => [a.key!, a.unlockedAt!])),
    };
  },

  async list(userId: Types.ObjectId): Promise<AchievementDTO[]> {
    const { metrics, unlocked } = await this.metrics(userId);
    return ACHIEVEMENTS.map((def) => toDTO(def, metrics, unlocked.get(def.key) ?? null));
  },

  /** Unlock anything newly earned. The $ne guard makes each unlock (and its XP) happen once. */
  async check(userId: Types.ObjectId, out: ProgressCollector): Promise<void> {
    const { metrics, unlocked } = await this.metrics(userId);
    for (const def of ACHIEVEMENTS) {
      if (unlocked.has(def.key) || metrics[def.metric] < def.target) continue;
      const now = new Date();
      const res = await User.updateOne(
        { _id: userId, 'achievements.key': { $ne: def.key } },
        { $push: { achievements: { key: def.key, unlockedAt: now } } },
      );
      if (res.modifiedCount !== 1) continue;
      if (def.xp > 0) await XPService.award(userId, def.xp);
      out.achievement(toDTO(def, metrics, now));
    }
  },
};
