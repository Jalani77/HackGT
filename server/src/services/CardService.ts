import { Types } from 'mongoose';
import type { CardDTO, CardCategory, Season } from '../../../shared/types';
import type { Rarity } from '../../../shared/rarity';
import { Card, type CardDoc } from '../models/Card';
import { User } from '../models/User';
import { toCanonicalKey } from '../utils/gameEnvironment';
import type { ObjectAnalysis } from './ai';
import { RarityService } from './RarityService';

export interface CatalogQuery {
  campusId: string;
  category?: CardCategory;
  rarity?: Rarity;
  q?: string;
  limit?: number;
}

export const CardService = {
  /**
   * Atomically find the catalog card for this analysis on this campus, creating it if new.
   * Returns whether this call created it (i.e. first discovery on campus).
   */
  async findOrCreate(params: {
    campusId: string;
    analysis: ObjectAnalysis;
    imageUrl: string;
    discovererId: Types.ObjectId;
    initialRarity: { rarity: Rarity; rarityScore: number };
  }): Promise<{ card: CardDoc; created: boolean }> {
    const { campusId, analysis, imageUrl, discovererId, initialRarity } = params;
    const canonicalKey = toCanonicalKey(analysis.canonicalName || analysis.name);

    const result = await Card.findOneAndUpdate(
      { campusId, canonicalKey },
      {
        $setOnInsert: {
          campusId,
          canonicalKey,
          name: analysis.name,
          category: analysis.category,
          description: analysis.description,
          funFact: analysis.funFact,
          tags: analysis.tags,
          imageUrl,
          commonness: analysis.commonness,
          rarity: initialRarity.rarity,
          rarityScore: initialRarity.rarityScore,
          'flags.isLandmark': analysis.isLandmark,
          firstDiscoveredBy: discovererId,
          source: 'discovery',
        },
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true },
    );
    return { card: result.value as CardDoc, created: !result.lastErrorObject?.updatedExisting };
  },

  /** Record a discovery against the card's stats and re-score its rarity. */
  async recordDiscovery(
    card: CardDoc,
    opts: { newDiscoverer: boolean; confidence: number; season: Season },
  ): Promise<CardDoc> {
    const priorDiscoveries = card.stats?.discoveryCount ?? 0;
    const { rarity, rarityScore } = RarityService.score({
      commonness: (card.commonness ?? 3) as 1 | 2 | 3 | 4 | 5,
      category: card.category as CardCategory,
      priorDiscoveries,
      confidence: opts.confidence,
      isLandmark: !!card.flags?.isLandmark,
      isEvent: !!card.flags?.isEvent,
      requiresGroup: !!card.flags?.requiresGroup,
      requiresMission: !!card.flags?.requiresMission,
      seasonal: card.flags?.seasonal ?? [],
      currentSeason: opts.season,
    });
    const updated = await Card.findByIdAndUpdate(
      card._id,
      {
        $inc: { 'stats.discoveryCount': 1, 'stats.uniqueDiscoverers': opts.newDiscoverer ? 1 : 0 },
        $set: { rarity, rarityScore },
      },
      { returnDocument: 'after' },
    );
    return updated!;
  },

  async knownNames(campusId: string, limit = 80): Promise<string[]> {
    const cards = await Card.find({ campusId }).sort({ updatedAt: -1 }).limit(limit).select('name').lean();
    return cards.map((c) => c.name);
  },

  async list(query: CatalogQuery): Promise<CardDTO[]> {
    const filter: Record<string, unknown> = { campusId: query.campusId };
    if (query.category) filter.category = query.category;
    if (query.rarity) filter.rarity = query.rarity;
    if (query.q) filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
    const cards = await Card.find(filter)
      .sort({ rarityScore: -1 })
      .limit(Math.min(query.limit ?? 100, 200));
    return this.toDTOs(cards);
  },

  async getById(id: string): Promise<CardDTO | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const card = await Card.findById(id);
    return card ? (await this.toDTOs([card]))[0] : null;
  },

  /** Batch-convert to DTOs, resolving demand ("wanted by") and discoverer names in two queries. */
  async toDTOs(cards: CardDoc[]): Promise<CardDTO[]> {
    if (!cards.length) return [];
    const ids = cards.map((c) => c._id);
    const [demand, discoverers] = await Promise.all([
      User.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { wishlist: { $in: ids } } },
        { $unwind: '$wishlist' },
        { $match: { wishlist: { $in: ids } } },
        { $group: { _id: '$wishlist', n: { $sum: 1 } } },
      ]),
      User.find({ _id: { $in: cards.map((c) => c.firstDiscoveredBy).filter(Boolean) } })
        .select('username')
        .lean(),
    ]);
    const wanted = new Map(demand.map((d) => [String(d._id), d.n]));
    const names = new Map(discoverers.map((u) => [String(u._id), u.username]));

    return cards.map((c) => {
      const wantedBy = wanted.get(String(c._id)) ?? 0;
      const discovererId = c.firstDiscoveredBy ? String(c.firstDiscoveredBy) : null;
      return {
        id: String(c._id),
        campusId: c.campusId,
        name: c.name,
        category: c.category as CardCategory,
        description: c.description,
        funFact: c.funFact,
        tags: c.tags,
        imageUrl: c.imageUrl,
        rarity: c.rarity as Rarity,
        rarityScore: c.rarityScore,
        tradeValue: RarityService.tradeValue(c.rarityScore, wantedBy),
        flags: {
          isLandmark: !!c.flags?.isLandmark,
          isEvent: !!c.flags?.isEvent,
          requiresGroup: !!c.flags?.requiresGroup,
          requiresMission: !!c.flags?.requiresMission,
        },
        stats: {
          discoveryCount: c.stats?.discoveryCount ?? 0,
          uniqueDiscoverers: c.stats?.uniqueDiscoverers ?? 0,
          wantedBy,
        },
        firstDiscoveredBy: discovererId ? { id: discovererId, username: names.get(discovererId) ?? 'unknown' } : null,
        source: c.source as CardDTO['source'],
        createdAt: c.createdAt.toISOString(),
      };
    });
  },
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60);
}
