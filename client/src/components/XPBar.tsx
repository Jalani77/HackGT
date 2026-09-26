import { motion } from 'motion/react';
import type { LevelInfo } from '@shared/types';

export function XPBar({ level }: { level: LevelInfo }) {
  const { xp, currentLevelXp, nextLevelXp } = level;
  const pct = nextLevelXp ? ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 : 100;
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60">
        <span>{xp} XP</span>
        <span>{nextLevelXp ? `${nextLevelXp - xp} XP to level ${level.level + 1}` : 'Max level'}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
