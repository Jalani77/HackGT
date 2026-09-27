import mongoose, { Types, type ClientSession } from 'mongoose';
import type { CreateTradeRequest, TradeAcceptResult, TradeDTO, TradeStatus } from '../../../shared/types';
import { supportsTransactions } from '../config/db';
import { xpConfig } from '../config/xp.config';
import { OwnedCard } from '../models/OwnedCard';
import { Trade, type TradeDoc } from '../models/Trade';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { cardMinis } from './SocialService';
import { UserService } from './UserService';
import { XPService } from './XPService';

const MAX_ITEMS_PER_SIDE = 5;
const MAX_PENDING_OUTGOING = 20;

interface Move {
  copyId: Types.ObjectId;
  from: Types.ObjectId;
  to: Types.ObjectId;
}

class CopyUnavailableError extends Error {}

const toIds = (ids: string[], label: string) => {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new AppError('VALIDATION', `Duplicate cards in ${label}.`);
  if (unique.some((id) => !Types.ObjectId.isValid(id))) throw new AppError('VALIDATION', `Invalid card in ${label}.`);
  return unique.map((id) => new Types.ObjectId(id));
};

export const TradeService = {
  async create(from: UserDoc, req: CreateTradeRequest): Promise<TradeDTO> {
    if (!Types.ObjectId.isValid(req.toUserId)) throw new AppError('NOT_FOUND', 'Student not found.');
    if (req.toUserId === String(from._id)) throw new AppError('VALIDATION', "You can't trade with yourself.");
    const to = await User.findOne({ _id: req.toUserId, campusId: from.campusId });
    if (!to) throw new AppError('NOT_FOUND', 'Student not found.');

    const offeredIds = toIds(req.offeredCopyIds, 'your offer');
    const requestedIds = toIds(req.requestedCopyIds, 'your request');
    if (offeredIds.length < 1) throw new AppError('VALIDATION', 'Offer at least one card.');
    if (offeredIds.length > MAX_ITEMS_PER_SIDE || requestedIds.length > MAX_ITEMS_PER_SIDE) {
      throw new AppError('VALIDATION', `Trades are limited to ${MAX_ITEMS_PER_SIDE} cards per side.`);
    }

    // Ownership + tradable checks at proposal time (re-checked on accept).
    const [offered, requested, pending] = await Promise.all([
      OwnedCard.find({ _id: { $in: offeredIds }, ownerId: from._id, tradable: true }).select('cardId'),
      OwnedCard.find({ _id: { $in: requestedIds }, ownerId: to._id, tradable: true }).select('cardId'),
      Trade.countDocuments({ fromUserId: from._id, status: 'pending' }),
    ]);
    if (offered.length !== offeredIds.length) {
      throw new AppError('CONFLICT', "One of the cards you offered isn't yours or isn't marked tradable.");
    }
    if (requested.length !== requestedIds.length) {
      throw new AppError('CONFLICT', `One of the cards you asked for is no longer tradable by ${to.displayName}.`);
    }
    if (pending >= MAX_PENDING_OUTGOING) {
      throw new AppError('CONFLICT', `You have ${pending} open offers. Wait for replies or cancel some first.`);
    }

    const trade = await Trade.create({
      fromUserId: from._id,
      toUserId: to._id,
      offered: offered.map((c) => ({ copyId: c._id, cardId: c.cardId })),
      requested: requested.map((c) => ({ copyId: c._id, cardId: c.cardId })),
      message: req.message?.trim().slice(0, 200) ?? '',
    });
    return (await this.toDTOs([trade], from._id))[0];
  },

  async list(user: UserDoc, status?: TradeStatus): Promise<TradeDTO[]> {
    const filter: Record<string, unknown> = { $or: [{ fromUserId: user._id }, { toUserId: user._id }] };
    if (status) filter.status = status;
    const trades = await Trade.find(filter).sort({ updatedAt: -1 }).limit(50);
    return this.toDTOs(trades, user._id);
  },

  async accept(user: UserDoc, tradeId: string): Promise<TradeAcceptResult> {
    // Claim the trade first so two accept taps (or accept + cancel) can't both win.
    const trade = await this.claim(tradeId, { toUserId: user._id }, 'processing');

    const moves: Move[] = [
      ...trade.offered.map((i) => ({ copyId: i.copyId, from: trade.fromUserId, to: trade.toUserId })),
      ...trade.requested.map((i) => ({ copyId: i.copyId, from: trade.toUserId, to: trade.fromUserId })),
    ];
    try {
      await executeMoves(moves);
    } catch (err) {
      if (!(err instanceof CopyUnavailableError)) {
        await Trade.updateOne({ _id: trade._id }, { $set: { status: 'pending' } }); // unexpected: let them retry
        throw err;
      }
      await resolve(trade._id, 'expired', 'Some cards were no longer available.');
      throw new AppError('CONFLICT', 'Some cards in this trade are no longer available, so the offer was closed.');
    }
    await resolve(trade._id, 'accepted');

    const movedIds = moves.map((m) => m.copyId);
    await Promise.all([
      User.updateMany({ _id: { $in: [trade.fromUserId, trade.toUserId] } }, { $inc: { 'stats.trades': 1 } }),
      // Cards you just received come off your wishlist.
      User.updateOne({ _id: trade.toUserId }, { $pull: { wishlist: { $in: trade.offered.map((i) => i.cardId) } } }),
      User.updateOne({ _id: trade.fromUserId }, { $pull: { wishlist: { $in: trade.requested.map((i) => i.cardId) } } }),
      // Any other open offer involving these copies can no longer succeed.
      Trade.updateMany(
        {
          _id: { $ne: trade._id },
          status: 'pending',
          $or: [{ 'offered.copyId': { $in: movedIds } }, { 'requested.copyId': { $in: movedIds } }],
        },
        { $set: { status: 'expired', statusReason: 'A card in this offer was traded to someone else.', resolvedAt: new Date() } },
      ),
    ]);

    const [mine] = await Promise.all([
      XPService.award(trade.toUserId, xpConfig.trade),
      XPService.award(trade.fromUserId, xpConfig.trade),
    ]);
    const fresh = (await User.findById(user._id))!;
    const done = (await Trade.findById(trade._id))!;
    return {
      trade: (await this.toDTOs([done], user._id))[0],
      xpAwarded: xpConfig.trade,
      levelUp: mine.levelUp,
      player: await UserService.toPublic(fresh, { isSelf: true }),
    };
  },

  async decline(user: UserDoc, tradeId: string): Promise<TradeDTO> {
    const trade = await this.claim(tradeId, { toUserId: user._id }, 'declined');
    return (await this.toDTOs([trade], user._id))[0];
  },

  async cancel(user: UserDoc, tradeId: string): Promise<TradeDTO> {
    const trade = await this.claim(tradeId, { fromUserId: user._id }, 'cancelled');
    return (await this.toDTOs([trade], user._id))[0];
  },

  /** Atomically move a pending trade (that this user is allowed to act on) to a new status. */
  async claim(
    tradeId: string,
    party: { toUserId: Types.ObjectId } | { fromUserId: Types.ObjectId },
    status: TradeStatus,
  ): Promise<TradeDoc> {
    if (!Types.ObjectId.isValid(tradeId)) throw new AppError('NOT_FOUND', 'Trade not found.');
    const final = status !== 'processing';
    const trade = await Trade.findOneAndUpdate(
      { _id: tradeId, ...party, status: 'pending' },
      { $set: { status, ...(final ? { resolvedAt: new Date() } : {}) } },
      { returnDocument: 'after' },
    );
    if (trade) return trade;
    if (await Trade.exists({ _id: tradeId, ...party })) throw new AppError('CONFLICT', 'This trade is no longer open.');
    throw new AppError('NOT_FOUND', 'Trade not found.');
  },

  async toDTOs(trades: TradeDoc[], viewerId: Types.ObjectId): Promise<TradeDTO[]> {
    if (!trades.length) return [];
    const userIds = [...new Set(trades.flatMap((t) => [String(t.fromUserId), String(t.toUserId)]))];
    const cardIds = [...new Set(trades.flatMap((t) => [...t.offered, ...t.requested].map((i) => String(i.cardId))))];
    const [users, minis] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('username displayName xp'),
      cardMinis(cardIds.map((id) => new Types.ObjectId(id))),
    ]);
    const summaries = new Map(users.map((u) => [String(u._id), UserService.toSummary(u)]));
    const missing = { id: '', username: 'deleted', displayName: 'Former student', level: 1, levelTitle: '' };
    const item = (i: { copyId: Types.ObjectId; cardId: Types.ObjectId }) => ({
      copyId: String(i.copyId),
      card: minis.get(String(i.cardId)) ?? { id: String(i.cardId), name: 'Unknown card', rarity: 'COMMON' as const, imageUrl: '' },
    });
    return trades.map((t) => ({
      id: String(t._id),
      direction: String(t.toUserId) === String(viewerId) ? 'incoming' : 'outgoing',
      from: summaries.get(String(t.fromUserId)) ?? missing,
      to: summaries.get(String(t.toUserId)) ?? missing,
      offered: t.offered.map(item),
      requested: t.requested.map(item),
      message: t.message ?? '',
      status: t.status as TradeStatus,
      statusReason: t.statusReason ?? '',
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    }));
  },
};

function resolve(id: Types.ObjectId, status: TradeStatus, statusReason = '') {
  return Trade.updateOne({ _id: id }, { $set: { status, statusReason, resolvedAt: new Date() } });
}

/**
 * Move every copy to its new owner, or none of them. Each update is conditional on the
 * current owner still holding it as tradable, which is the server-side ownership check.
 * Uses a real transaction on replica sets (Atlas); otherwise compensates on failure.
 */
async function executeMoves(moves: Move[]): Promise<void> {
  const now = new Date();
  const moveOne = (m: Move, session?: ClientSession) =>
    OwnedCard.updateOne(
      { _id: m.copyId, ownerId: m.from, tradable: true },
      { $set: { ownerId: m.to, tradable: false, favorite: false, acquiredVia: 'trade', acquiredAt: now } },
      { session },
    );

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const m of moves) {
          if ((await moveOne(m, session)).modifiedCount !== 1) throw new CopyUnavailableError();
        }
      });
    } finally {
      await session.endSession();
    }
    return;
  }

  // No transactions (local dev): apply moves one by one and roll back on the first failure.
  const originals = new Map(
    (await OwnedCard.find({ _id: { $in: moves.map((m) => m.copyId) } }).lean()).map((c) => [String(c._id), c]),
  );
  const done: Move[] = [];
  for (const m of moves) {
    if ((await moveOne(m)).modifiedCount !== 1) {
      for (const d of done.reverse()) {
        const o = originals.get(String(d.copyId))!;
        await OwnedCard.updateOne(
          { _id: d.copyId, ownerId: d.to },
          { $set: { ownerId: d.from, tradable: o.tradable, favorite: o.favorite, acquiredVia: o.acquiredVia, acquiredAt: o.acquiredAt } },
        );
      }
      throw new CopyUnavailableError();
    }
    done.push(m);
  }
}
