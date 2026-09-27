import { Types } from 'mongoose';
import type { CardMini, CardSocial, StudentListItem } from '../../../shared/types';
import type { Rarity } from '../../../shared/rarity';
import { Card } from '../models/Card';
import { OwnedCard } from '../models/OwnedCard';
import { User, type UserDoc } from '../models/User';
import { UserService } from './UserService';

export async function cardMinis(ids: Types.ObjectId[]): Promise<Map<string, CardMini>> {
  const cards = await Card.find({ _id: { $in: ids } }).select('name rarity imageUrl').lean();
  return new Map(
    cards.map((c) => [String(c._id), { id: String(c._id), name: c.name, rarity: c.rarity as Rarity, imageUrl: c.imageUrl }]),
  );
}

/** Tradable card ids per owner. */
async function tradableByOwner(ownerIds: Types.ObjectId[]) {
  const rows = await OwnedCard.aggregate<{ _id: Types.ObjectId; cardIds: Types.ObjectId[]; copies: number }>([
    { $match: { ownerId: { $in: ownerIds }, tradable: true } },
    { $group: { _id: '$ownerId', cardIds: { $addToSet: '$cardId' }, copies: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

export const SocialService = {
  /**
   * Students on the same campus, ranked by how well they match you for trading:
   * people who have what you want and want what you have float to the top.
   */
  async students(viewer: UserDoc, q?: string): Promise<StudentListItem[]> {
    const filter: Record<string, unknown> = { campusId: viewer.campusId, _id: { $ne: viewer._id } };
    if (q) filter.username = { $regex: `^${q.replace(/[^a-z0-9_]/gi, '')}`, $options: 'i' };
    const others = await User.find(filter).select('username displayName xp wishlist').sort({ xp: -1 }).limit(200);

    const tradable = await tradableByOwner([viewer._id, ...others.map((o) => o._id)]);
    const myTradable = new Set((tradable.get(String(viewer._id))?.cardIds ?? []).map(String));
    const myWishlist = new Set((viewer.wishlist ?? []).map(String));

    const matches = others.map((o) => {
      const theirTradable = tradable.get(String(o._id));
      const theyWant = (o.wishlist ?? []).map(String).filter((id) => myTradable.has(id));
      const iWant = (theirTradable?.cardIds ?? []).map(String).filter((id) => myWishlist.has(id));
      return { o, theyWant, iWant, tradableCount: theirTradable?.copies ?? 0 };
    });

    const minis = await cardMinis(
      [...new Set(matches.flatMap((m) => [...m.theyWant, ...m.iWant]))].map((id) => new Types.ObjectId(id)),
    );

    return matches
      .map(({ o, theyWant, iWant, tradableCount }) => ({
        ...UserService.toSummary(o),
        wishlistCount: o.wishlist?.length ?? 0,
        tradableCount,
        theyWantFromMe: theyWant.map((id) => minis.get(id)!).filter(Boolean),
        iWantFromThem: iWant.map((id) => minis.get(id)!).filter(Boolean),
      }))
      .sort(
        (a, b) =>
          b.iWantFromThem.length + b.theyWantFromMe.length - (a.iWantFromThem.length + a.theyWantFromMe.length) ||
          b.level - a.level,
      );
  },

  /** "Who wants this card?" and "who could trade it to me?" */
  async cardSocial(viewer: UserDoc, cardId: string): Promise<CardSocial> {
    if (!Types.ObjectId.isValid(cardId)) return { inMyWishlist: false, wantedBy: [], tradableBy: [] };
    const id = new Types.ObjectId(cardId);
    const [wanters, holders] = await Promise.all([
      User.find({ wishlist: id, _id: { $ne: viewer._id }, campusId: viewer.campusId })
        .select('username displayName xp')
        .limit(30),
      OwnedCard.aggregate<{ _id: Types.ObjectId; copies: number }>([
        { $match: { cardId: id, tradable: true, ownerId: { $ne: viewer._id } } },
        { $group: { _id: '$ownerId', copies: { $sum: 1 } } },
        { $limit: 30 },
      ]),
    ]);
    const holderUsers = await User.find({ _id: { $in: holders.map((h) => h._id) } }).select('username displayName xp');
    const copies = new Map(holders.map((h) => [String(h._id), h.copies]));
    return {
      inMyWishlist: (viewer.wishlist ?? []).some((w) => String(w) === cardId),
      wantedBy: wanters.map((u) => UserService.toSummary(u)),
      tradableBy: holderUsers.map((u) => ({ ...UserService.toSummary(u), copies: copies.get(String(u._id)) ?? 0 })),
    };
  },
};
