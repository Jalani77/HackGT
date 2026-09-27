import { Types } from 'mongoose';
import type { PublicUser, StudentSummary } from '../../../shared/types';
import { Trade } from '../models/Trade';
import { User, type UserDoc } from '../models/User';
import { CollectionService } from './CollectionService';
import { XPService } from './XPService';

export const UserService = {
  async getById(id: string | Types.ObjectId): Promise<UserDoc | null> {
    if (!Types.ObjectId.isValid(String(id))) return null;
    return User.findById(id);
  },

  toSummary(user: Pick<UserDoc, '_id' | 'username' | 'displayName' | 'xp'>): StudentSummary {
    const info = XPService.levelFor(user.xp ?? 0);
    return {
      id: String(user._id),
      username: user.username,
      displayName: user.displayName,
      level: info.level,
      levelTitle: info.title,
    };
  },

  /** Public profile. Never includes passwordHash or anything location-related. */
  async toPublic(user: UserDoc, opts: { isSelf?: boolean } = {}): Promise<PublicUser> {
    const [counts, incomingTrades] = await Promise.all([
      CollectionService.counts(user._id),
      opts.isSelf ? Trade.countDocuments({ toUserId: user._id, status: 'pending' }) : Promise.resolve(0),
    ]);
    return {
      id: String(user._id),
      username: user.username,
      displayName: user.displayName,
      campusId: user.campusId,
      level: XPService.levelFor(user.xp),
      stats: {
        discoveries: user.stats?.discoveries ?? 0,
        trades: user.stats?.trades ?? 0,
        ...counts,
      },
      notifications: { incomingTrades },
      createdAt: user.createdAt.toISOString(),
    };
  },
};
