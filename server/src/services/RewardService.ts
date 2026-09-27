import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import type { GrantedReward, RedeemResult, RewardDTO } from '../../../shared/types';
import { Redemption, Reward, type RewardDoc } from '../models/Reward';
import type { UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { GrantService } from './GrantService';
import { cardMinis } from './SocialService';
import { XPService } from './XPService';

const isDuplicateKeyError = (e: unknown) => (e as { code?: number })?.code === 11000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const redemptionCode = () =>
  `CQ-${Array.from({ length: 8 }, (_, i) => (i === 4 ? '-' : '') + ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

const available = (campusId: string) => ({
  campusId,
  active: true,
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const RewardService = {
  async list(user: UserDoc): Promise<RewardDTO[]> {
    const rewards = await Reward.find(available(user.campusId)).sort({ minLevel: 1, title: 1 });
    return this.toDTOs(rewards, user);
  },

  /** Claim a level perk. Level is checked server-side; each student can redeem a reward once. */
  async redeem(user: UserDoc, id: string): Promise<RedeemResult> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND', 'Reward not found.');
    const reward = await Reward.findOne({ _id: id, ...available(user.campusId) });
    if (!reward) throw new AppError('NOT_FOUND', 'Reward not found or no longer available.');
    if (XPService.levelFor(user.xp).level < reward.minLevel) {
      throw new AppError('FORBIDDEN', `Reach level ${reward.minLevel} to unlock this reward.`);
    }
    if (await Redemption.exists({ userId: user._id, rewardId: reward._id })) {
      return { reward: (await this.toDTOs([reward], user))[0], grant: null }; // idempotent
    }

    if (reward.stock != null) {
      const took = await Reward.updateOne({ _id: reward._id, stock: { $gt: 0 } }, { $inc: { stock: -1 } });
      if (took.modifiedCount !== 1) throw new AppError('CONFLICT', 'Sorry, this reward just ran out.');
    }
    try {
      await Redemption.create({ userId: user._id, rewardId: reward._id, code: redemptionCode() });
    } catch (e) {
      if (reward.stock != null) await Reward.updateOne({ _id: reward._id }, { $inc: { stock: 1 } });
      if (!isDuplicateKeyError(e)) throw e;
      return { reward: (await this.toDTOs([reward], user))[0], grant: null }; // a concurrent tap won
    }

    let grant: GrantedReward | null = null;
    if (reward.type === 'collectible' && reward.cardId) {
      grant = await GrantService.grant(user._id, {
        source: 'reward',
        sourceId: reward._id,
        title: reward.title,
        headline: 'EXCLUSIVE REWARD!',
        xp: 0,
        cardId: reward.cardId,
        via: 'reward',
      });
    }
    return { reward: (await this.toDTOs([reward], user))[0], grant };
  },

  async toDTOs(rewards: RewardDoc[], user: UserDoc): Promise<RewardDTO[]> {
    const level = XPService.levelFor(user.xp).level;
    const [redemptions, minis] = await Promise.all([
      Redemption.find({ userId: user._id, rewardId: { $in: rewards.map((r) => r._id) } }),
      cardMinis(rewards.map((r) => r.cardId).filter(Boolean) as Types.ObjectId[]),
    ]);
    const redeemed = new Map(redemptions.map((r) => [String(r.rewardId), r]));
    return rewards.map((r) => {
      const red = redeemed.get(String(r._id));
      return {
        id: String(r._id),
        title: r.title,
        partner: r.partner,
        description: r.description,
        icon: r.icon,
        type: r.type as RewardDTO['type'],
        minLevel: r.minLevel,
        unlocked: level >= r.minLevel,
        card: r.cardId ? (minis.get(String(r.cardId)) ?? null) : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        redemption: red ? { code: red.code, redeemedAt: red.redeemedAt.toISOString() } : null,
      };
    });
  },
};
