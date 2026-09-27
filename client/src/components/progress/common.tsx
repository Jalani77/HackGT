import { motion } from 'motion/react';
import type { CardMini, EventKind } from '@shared/types';
import { MiniCard } from '../social/MiniCard';

export const EVENT_ICON: Record<EventKind, string> = {
  walk: '🚶',
  tour: '🏛️',
  scavenger: '🧩',
  cleanup: '🧹',
  photo: '📸',
  social: '🎉',
  charity: '💛',
  other: '✨',
};

export function Bar({ value, target, className = '' }: { value: number; target: number; className?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

/** "+150 XP · [card]" reward line used by missions, events, and routes. */
export function RewardLine({ xp, card, label = 'Reward' }: { xp: number; card: CardMini | null; label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-bold uppercase tracking-wider text-white/45">{label}</span>
      {xp > 0 && <span className="font-display font-bold text-accent">+{xp} XP</span>}
      {card && (
        <span className="flex items-center gap-1.5">
          <MiniCard card={card} size={24} highlight />
          <span className="font-semibold text-accent-2">{card.name}</span>
        </span>
      )}
    </div>
  );
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 864e5);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">{children}</h2>;
}
