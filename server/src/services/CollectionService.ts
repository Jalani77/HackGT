import { Types } from 'mongoose';
import type {
  AcquiredVia,
  CollectionResponse,
  CopyPatch,
  OwnedCardDTO,
  Season,
  TimeOfDay,
} from '../../../shared/types';
import { Card } from '../models/Card';
import { OwnedCard, type OwnedCardDoc } from '../models/OwnedCard';
import { AppError } from '../utils/AppError';
import { CardService } from './CardService';

export const CollectionService = {
  async ownsCard(userId: Types.ObjectId, cardId: Types.ObjectId): Promise<boolean> {
    return !!(await OwnedCard.exists({ ownerId: userId, cardId }));
  },

  async addCopy(params: {
    ownerId: Types.ObjectId;
    cardId: Types.ObjectId;
    imageUrl: string;
    acquiredVia: AcquiredVia;
    xpAwarded: number;
    environment: { season: Season; timeOfDay: TimeOfDay } | null;
    discoveryId?: Types.ObjectId;
    _id?: Types.ObjectId;
  }): Promise<OwnedCardDoc> {
    return OwnedCard.create(params);
  },

  async getCollection(userId: string, campusId: string): Promise<CollectionResponse> {
    const copies = await OwnedCard.find({ ownerId: userId }).sort({ acquiredAt: -1 });
    const cardIds = [...new Set(copies.map((c) => String(c.cardId)))].map((id) => new Types.ObjectId(id));
    const [cards, catalogSize] = await Promise.all([
      Card.find({ _id: { $in: cardIds } }).then((docs) => CardService.toDTOs(docs)),
      Card.countDocuments({ campusId }),
    ]);

    const byCard = new Map<string, OwnedCardDTO[]>();
    for (const copy of copies) {
      const key = String(copy.cardId);
      byCard.set(key, [...(byCard.get(key) ?? []), toCopyDTO(copy)]);
    }
    // Most recently acquired first.
    const entries = cards
      .map((card) => ({ card, copies: byCard.get(card.id) ?? [] }))
      .sort((a, b) => b.copies[0].acquiredAt.localeCompare(a.copies[0].acquiredAt));

    return {
      entries,
      totals: {
        uniqueOwned: cards.length,
        copies: copies.length,
        catalogSize,
        completion: catalogSize ? Math.round((cards.length / catalogSize) * 1000) / 10 : 0,
      },
    };
  },

  /**
   * Update player-controlled flags on a copy. The ownerId filter is the ownership check:
   * a copy that isn't yours simply isn't found.
   */
  async updateCopy(ownerId: Types.ObjectId, copyId: string, patch: CopyPatch): Promise<OwnedCardDTO> {
    if (!Types.ObjectId.isValid(copyId)) throw new AppError('NOT_FOUND', 'Card copy not found.');
    const copy = await OwnedCard.findOneAndUpdate(
      { _id: copyId, ownerId },
      { $set: patch },
      { returnDocument: 'after' },
    );
    if (!copy) throw new AppError('NOT_FOUND', 'Card copy not found.');
    return toCopyDTO(copy);
  },

  async counts(userId: Types.ObjectId | string): Promise<{ cardsOwned: number; uniqueCards: number }> {
    const [cardsOwned, unique] = await Promise.all([
      OwnedCard.countDocuments({ ownerId: userId }),
      OwnedCard.distinct('cardId', { ownerId: userId }),
    ]);
    return { cardsOwned, uniqueCards: unique.length };
  },
};

export function toCopyDTO(c: OwnedCardDoc): OwnedCardDTO {
  return {
    id: String(c._id),
    cardId: String(c.cardId),
    ownerId: String(c.ownerId),
    imageUrl: c.imageUrl,
    acquiredVia: c.acquiredVia as AcquiredVia,
    tradable: c.tradable,
    favorite: c.favorite,
    acquiredAt: c.acquiredAt.toISOString(),
    xpAwarded: c.xpAwarded,
    environment: c.environment?.season
      ? { season: c.environment.season as Season, timeOfDay: c.environment.timeOfDay as TimeOfDay }
      : null,
  };
}
