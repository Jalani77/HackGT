import { RARITY_DISPLAY, rarityRank } from '@shared/rarity';
import type { CardDTO } from '@shared/types';
import { CATEGORY_ICON } from './categoryIcons';
import { RarityBadge, Stars } from './RarityBadge';

interface Props {
  card: CardDTO;
  /** Art for this particular copy (the owner's photo); defaults to the catalog art. */
  imageUrl?: string;
  copies?: number;
  favorite?: boolean;
  tradable?: boolean;
  compact?: boolean;
}

/**
 * The collectible card face. All visual variation is driven by rarity, never by the
 * specific card, so any AI-discovered object renders correctly.
 */
export function CollectibleCard({ card, imageUrl, copies, favorite, tradable, compact = false }: Props) {
  const d = RARITY_DISPLAY[card.rarity];
  const rank = rarityRank(card.rarity);
  const foil = rank >= 3; // epic+
  const sheen = rank >= 2; // rare+

  return (
    <div className="relative aspect-[5/7] w-full select-none">
      {foil && (
        <div className="absolute -inset-[3px] overflow-hidden rounded-[22px]">
          <div
            className="foil-ring absolute -inset-1/2"
            style={{
              background: `conic-gradient(from 0deg, ${d.color}, #fff8, ${d.color}, transparent 60%, ${d.color})`,
            }}
          />
        </div>
      )}
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[20px] ${sheen ? 'card-sheen' : ''}`}
        style={{
          background: `linear-gradient(160deg, ${d.color}33 0%, #14141f 35%, #0c0c14 100%)`,
          boxShadow: `inset 0 0 0 2px ${d.color}aa, 0 10px 40px -10px ${d.glow}`,
        }}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-2 ${compact ? 'px-2.5 pt-2' : 'px-4 pt-3.5'}`}>
          <h3
            className={`font-display font-bold uppercase leading-tight tracking-wide ${
              compact ? 'line-clamp-2 text-[11px]' : 'line-clamp-2 text-base'
            }`}
          >
            {card.name}
          </h3>
          <span className={compact ? 'text-sm' : 'text-xl'} title={card.category}>
            {CATEGORY_ICON[card.category]}
          </span>
        </div>

        {/* Art */}
        <div className={compact ? 'mx-2 mt-1.5' : 'mx-3.5 mt-2.5'}>
          <div
            className={`relative overflow-hidden rounded-xl ${compact ? 'aspect-square' : 'aspect-[4/3]'}`}
            style={{ boxShadow: `0 0 0 1px ${d.color}66` }}
          >
            <img src={imageUrl ?? card.imageUrl} alt={card.name} className="h-full w-full object-cover" draggable={false} />
            {(favorite || tradable) && (
              <span className="absolute left-1.5 top-1.5 flex gap-1">
                {favorite && (
                  <span className="rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-accent-2">★</span>
                )}
                {tradable && <span className="rounded-full bg-black/70 px-1.5 py-0.5 text-[10px]">🔄</span>}
              </span>
            )}
            {copies && copies > 1 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 font-display text-[10px] font-bold">
                ×{copies}
              </span>
            )}
          </div>
        </div>

        {/* Rarity */}
        <div className={`flex items-center justify-between ${compact ? 'px-2.5 pt-1.5' : 'px-4 pt-3'}`}>
          <Stars rarity={card.rarity} className={compact ? 'text-[10px]' : 'text-base'} />
          <RarityBadge rarity={card.rarity} />
        </div>

        {!compact && (
          <>
            <p className="mx-4 mt-2.5 line-clamp-2 text-[13px] italic leading-snug text-white/80">“{card.funFact}”</p>
            <div className="mt-auto flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[11px] text-white/60">
              <span>
                Value <b className="font-display text-white">{card.tradeValue}</b>
              </span>
              <span>{card.category}</span>
              <span>
                {card.stats.wantedBy > 0 ? `❤️ ${card.stats.wantedBy} want this` : `🔎 found ${card.stats.discoveryCount}×`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
