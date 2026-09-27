import { Types } from 'mongoose';
import type { WishlistEntry } from '../../../shared/types';
import { Card } from '../models/Card';
import { OwnedCard } from '../models/OwnedCard';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { CardService } from './CardService';

const MAX_WISHLIST = 50;

export const WishlistService = {
  async add(user: UserDoc, cardId: string): Promise<void> {
    if (!Types.ObjectId.isValid(cardId)) throw new AppError('NOT_FOUND', 'Card not found.');
    const card = await Card.findOne({ _id: cardId, campusId: user.campusId }).select('_id');
    if (!card) throw new AppError('NOT_FOUND', 'Card not found.');
    // Size guard in the filter keeps the cap atomic.
    const res = await User.updateOne(
      { _id: user._id, [`wishlist.${MAX_WISHLIST - 1}`]: { $exists: false } },
      { $addToSet: { wishlist: card._id } },
    );
    if (res.matchedCount === 0) throw new AppError('CONFLICT', `Your wishlist is full (${MAX_WISHLIST} cards).`);
  },

  async remove(userId: Types.ObjectId, cardId: string): Promise<void> {
    if (!Types.ObjectId.isValid(cardId)) return;
    await User.updateOne({ _id: userId }, { $pull: { wishlist: new Types.ObjectId(cardId) } });
  },

  /** Someone's wishlist, annotated from the viewer's perspective. */
  async get(owner: UserDoc, viewerId: Types.ObjectId): Promise<WishlistEntry[]> {
    const ids = owner.wishlist ?? [];
    if (!ids.length) return [];
    const [cards, ownerCopies, viewerTradable, elsewhere] = await Promise.all([
      Card.find({ _id: { $in: ids } }).then((docs) => CardService.toDTOs(docs)),
      OwnedCard.distinct('cardId', { ownerId: owner._id, cardId: { $in: ids } }),
      OwnedCard.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { ownerId: viewerId, cardId: { $in: ids }, tradable: true } },
        { $group: { _id: '$cardId', n: { $sum: 1 } } },
      ]),
      OwnedCard.aggregate<{ _id: Types.ObjectId; owners: Types.ObjectId[] }>([
        { $match: { cardId: { $in: ids }, tradable: true, ownerId: { $ne: owner._id } } },
        { $group: { _id: '$cardId', owners: { $addToSet: '$ownerId' } } },
      ]),
    ]);
    const owned = new Set(ownerCopies.map(String));
    const mine = new Map(viewerTradable.map((v) => [String(v._id), v.n]));
    const others = new Map(elsewhere.map((e) => [String(e._id), e.owners.length]));
    // Keep the owner's wishlist order (most recently added last → show newest first).
    const order = new Map(ids.map((id, i) => [String(id), i]));
    return cards
      .sort((a, b) => order.get(b.id)! - order.get(a.id)!)
      .map((card) => ({
        card,
        ownedByUser: owned.has(card.id),
        viewerTradableCopies: mine.get(card.id) ?? 0,
        tradableElsewhere: others.get(card.id) ?? 0,
      }));
  },
};
