import { rarityRank } from '../../../shared/rarity';
import type { CardCategory, CollectionEntry, ProfileResponse } from '../../../shared/types';
import type { UserDoc } from '../models/User';
import { CollectionService } from './CollectionService';
import { DiscoveryService } from './DiscoveryService';
import { UserService } from './UserService';

export const ProfileService = {
  /** Profile built from the player's real collection. Contains no location data. */
  async build(user: UserDoc, viewerId: string): Promise<ProfileResponse> {
    const [publicUser, collection, recentDiscoveries] = await Promise.all([
      UserService.toPublic(user, { isSelf: String(user._id) === viewerId }),
      CollectionService.getCollection(String(user._id), user.campusId),
      DiscoveryService.listMine(user._id, 6),
    ]);
    const { entries } = collection;

    const rarestCard =
      entries.reduce<CollectionEntry | null>((best, e) => {
        if (!best) return e;
        const diff = rarityRank(e.card.rarity) - rarityRank(best.card.rarity);
        return diff > 0 || (diff === 0 && e.card.rarityScore > best.card.rarityScore) ? e : best;
      }, null) ?? null;

    const counts = new Map<CardCategory, number>();
    for (const e of entries) counts.set(e.card.category, (counts.get(e.card.category) ?? 0) + 1);

    return {
      user: publicUser,
      isMe: String(user._id) === viewerId,
      rarestCard,
      favorites: entries.filter((e) => e.copies.some((c) => c.favorite)).slice(0, 8),
      tradableCount: entries.reduce((n, e) => n + e.copies.filter((c) => c.tradable).length, 0),
      categories: [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      recentDiscoveries,
    };
  },
};
