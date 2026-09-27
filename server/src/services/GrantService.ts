import type { Types } from 'mongoose';
import type { AcquiredVia, GrantedReward } from '../../../shared/types';
import { Card } from '../models/Card';
import { User } from '../models/User';
import { seasonOf, timeOfDayOf } from '../utils/gameEnvironment';
import { CardService } from './CardService';
import { CollectionService, toCopyDTO } from './CollectionService';
import { XPService } from './XPService';

export interface GrantParams {
  source: GrantedReward['source'];
  sourceId: Types.ObjectId | string;
  title: string;
  headline: string;
  xp: number;
  cardId?: Types.ObjectId | null;
  via: AcquiredVia;
}

/**
 * The single path for paying out non-discovery rewards (missions, events, routes, level perks).
 * Callers must have already *claimed* the reward atomically, so this is never called twice for it.
 */
export const GrantService = {
  async grant(userId: Types.ObjectId, p: GrantParams): Promise<GrantedReward> {
    let card: GrantedReward['card'] = null;
    let copy: GrantedReward['copy'] = null;

    if (p.cardId) {
      const doc = await Card.findById(p.cardId);
      if (doc) {
        const hadIt = await CollectionService.ownsCard(userId, doc._id);
        const now = new Date();
        const created = await CollectionService.addCopy({
          ownerId: userId,
          cardId: doc._id,
          imageUrl: doc.imageUrl,
          acquiredVia: p.via,
          xpAwarded: p.xp,
          environment: { season: seasonOf(now), timeOfDay: timeOfDayOf(now) },
        });
        const [updated] = await Promise.all([
          Card.findByIdAndUpdate(
            doc._id,
            { $inc: { 'stats.discoveryCount': 1, 'stats.uniqueDiscoverers': hadIt ? 0 : 1 } },
            { returnDocument: 'after' },
          ),
          Card.updateOne({ _id: doc._id, firstDiscoveredBy: null }, { $set: { firstDiscoveredBy: userId } }),
          User.updateOne({ _id: userId }, { $pull: { wishlist: doc._id } }),
        ]);
        card = (await CardService.toDTOs([updated ?? doc]))[0];
        copy = toCopyDTO(created);
      }
    }

    if (p.xp > 0) await XPService.award(userId, p.xp);

    return {
      source: p.source,
      sourceId: String(p.sourceId),
      title: p.title,
      headline: p.headline,
      xp: p.xp,
      card,
      copy,
    };
  },
};
