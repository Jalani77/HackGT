import { Types } from 'mongoose';
import type { PublicUser } from '../../../shared/types';
import { User, type UserDoc } from '../models/User';
import { CollectionService } from './CollectionService';
import { XPService } from './XPService';

export const UserService = {
  async getById(id: string | Types.ObjectId): Promise<UserDoc | null> {
    if (!Types.ObjectId.isValid(String(id))) return null;
    return User.findById(id);
  },

  /** Public profile. Never includes passwordHash or anything location-related. */
  async toPublic(user: UserDoc): Promise<PublicUser> {
    const counts = await CollectionService.counts(user._id);
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
      createdAt: user.createdAt.toISOString(),
    };
  },
};
