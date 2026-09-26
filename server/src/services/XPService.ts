import type { Types } from 'mongoose';
import type { LevelInfo } from '../../../shared/types';
import { xpConfig } from '../config/xp.config';
import { User } from '../models/User';

export interface LevelUp {
  from: number;
  to: number;
  title: string;
}

export const XPService = {
  levelFor(xp: number): LevelInfo {
    const { levels } = xpConfig;
    let idx = 0;
    while (idx + 1 < levels.length && xp >= levels[idx + 1].xp) idx++;
    return {
      level: idx + 1,
      title: levels[idx].title,
      xp,
      currentLevelXp: levels[idx].xp,
      nextLevelXp: levels[idx + 1]?.xp ?? null,
    };
  },

  /**
   * Atomically add XP and recompute the level. The only code path that changes XP,
   * so clients can never set it directly.
   */
  async award(userId: Types.ObjectId | string, amount: number): Promise<{ xp: number; levelUp: LevelUp | null }> {
    const updated = await User.findByIdAndUpdate(userId, { $inc: { xp: amount } }, { returnDocument: 'after' });
    if (!updated) throw new Error('User not found while awarding XP');

    const info = this.levelFor(updated.xp);
    const previous = updated.level;
    if (info.level !== previous) {
      // Conditional update so concurrent awards can't move the level backwards.
      await User.updateOne({ _id: userId, level: { $lt: info.level } }, { $set: { level: info.level } });
    }
    return {
      xp: updated.xp,
      levelUp: info.level > previous ? { from: previous, to: info.level, title: info.title } : null,
    };
  },
};
