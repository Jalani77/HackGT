import { motion } from 'motion/react';
import type { ProgressUpdate } from '@shared/types';

/** Mission/route ticks and achievement unlocks from one action, as compact progress rows. */
export function ProgressList({ progress }: { progress: ProgressUpdate }) {
  const rows = [
    ...progress.missions.map((m) => ({
      key: `m-${m.missionId}`,
      icon: m.icon,
      label: m.title,
      sub: m.completed ? 'Mission complete!' : 'Mission progress',
      value: m.progress,
      target: m.target,
      done: m.completed,
    })),
    ...progress.routes.map((r) => ({
      key: `r-${r.routeId}`,
      icon: '🥾',
      label: r.title,
      sub: r.completed ? 'Route complete!' : `Checkpoint: ${r.checkpoint}`,
      value: r.done,
      target: r.total,
      done: r.completed,
    })),
  ];
  if (!rows.length && !progress.achievements.length) return null;

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      {rows.map((r, i) => (
        <motion.div
          key={r.key}
          className={`rounded-2xl p-3 ring-1 ${r.done ? 'bg-accent/15 ring-accent/50' : 'bg-white/5 ring-white/10'}`}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 + i * 0.12 }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{r.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.label}</div>
              <div className={`text-[11px] ${r.done ? 'font-bold text-accent' : 'text-white/55'}`}>{r.sub}</div>
            </div>
            <span className="font-display text-sm font-bold">
              {r.value}/{r.target}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
              initial={{ width: `${Math.max(0, ((r.value - 1) / r.target) * 100)}%` }}
              animate={{ width: `${(r.value / r.target) * 100}%` }}
              transition={{ delay: 1.1 + i * 0.12, duration: 0.7 }}
            />
          </div>
        </motion.div>
      ))}
      {progress.achievements.map((a, i) => (
        <motion.div
          key={a.key}
          className="flex items-center gap-3 rounded-2xl bg-accent-2/15 p-3 ring-1 ring-accent-2/50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 + (rows.length + i) * 0.12, type: 'spring' }}
        >
          <span className="text-2xl">{a.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest text-accent-2">ACHIEVEMENT UNLOCKED</div>
            <div className="truncate text-sm font-semibold">{a.title}</div>
          </div>
          {a.xp > 0 && <span className="font-display text-sm font-bold text-accent">+{a.xp}</span>}
        </motion.div>
      ))}
    </div>
  );
}
