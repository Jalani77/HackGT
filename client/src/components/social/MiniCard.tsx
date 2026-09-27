import { RARITY_DISPLAY } from '@shared/rarity';
import type { CardMini } from '@shared/types';

/** Small rarity-ringed thumbnail for lists (trades, matches, wishlists). */
export function MiniCard({
  card,
  size = 44,
  selected,
  highlight,
}: {
  card: CardMini;
  size?: number;
  selected?: boolean;
  highlight?: boolean;
}) {
  const d = RARITY_DISPLAY[card.rarity];
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        boxShadow: selected
          ? `0 0 0 3px var(--color-accent), 0 0 14px var(--color-accent)`
          : `0 0 0 2px ${d.color}${highlight ? '' : '99'}${highlight ? `, 0 0 12px ${d.color}` : ''}`,
      }}
      title={`${card.name} (${d.label})`}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-white/10" />
      )}
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center bg-accent/35 text-lg font-bold text-ink">✓</span>
      )}
    </div>
  );
}
