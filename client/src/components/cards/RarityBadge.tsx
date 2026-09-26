import { RARITY_DISPLAY, type Rarity } from '@shared/rarity';

export function Stars({ rarity, className = '' }: { rarity: Rarity; className?: string }) {
  const d = RARITY_DISPLAY[rarity];
  return (
    <span className={className} style={{ color: d.color }} aria-label={`${d.stars} star`}>
      {'★'.repeat(d.stars)}
    </span>
  );
}

export function RarityBadge({ rarity, size = 'sm' }: { rarity: Rarity; size?: 'sm' | 'lg' }) {
  const d = RARITY_DISPLAY[rarity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-bold uppercase tracking-wider ${
        size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2 py-0.5 text-[10px]'
      }`}
      style={{ color: d.color, background: `${d.color}1f`, boxShadow: `inset 0 0 0 1px ${d.color}66` }}
    >
      {d.label}
    </span>
  );
}
