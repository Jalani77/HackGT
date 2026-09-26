import type { Rarity } from '../../../shared/rarity';
import type { CardCategory } from '../../../shared/types';

/**
 * Rarity rules. Tweak these numbers to rebalance the game — no code changes needed.
 *
 * rarityScore (0–100) = commonness base
 *                     + campus scarcity bonus (decays as more people find it)
 *                     + landmark / category / season / special-source bonuses
 *                     − low-confidence penalty
 * The score is then mapped to a tier via `tiers`.
 */
export const rarityConfig = {
  /** AI's general-world commonness estimate (1 = everywhere … 5 = very unusual) → base score. */
  commonnessBase: { 1: 8, 2: 22, 3: 36, 4: 50, 5: 62 } as Record<1 | 2 | 3 | 4 | 5, number>,

  /** Bonus for being scarce on this campus: maxBonus / (1 + discoveries / halfLife). */
  scarcity: { maxBonus: 20, halfLife: 4 },

  bonuses: {
    landmark: 15,
    event: 30,
    requiresGroup: 20,
    requiresMission: 10,
    inSeason: 5,
  },

  category: {
    Landmark: 5,
    Art: 4,
    Animal: 3,
    Insect: 3,
  } as Partial<Record<CardCategory, number>>,

  lowConfidence: { threshold: 0.6, penalty: 8 },

  /** Minimum score for each tier, highest first. */
  tiers: [
    { tier: 'MYTHIC', min: 92 },
    { tier: 'LEGENDARY', min: 78 },
    { tier: 'EPIC', min: 62 },
    { tier: 'RARE', min: 42 },
    { tier: 'UNCOMMON', min: 26 },
    { tier: 'COMMON', min: 0 },
  ] as { tier: Rarity; min: number }[],

  /** Ordinary photo discoveries can't exceed this tier. Mythic is reserved for events. */
  maxTierForDiscovery: 'LEGENDARY' as Rarity,

  /** tradeValue = rarityScore * scoreWeight + wantedBy * demandWeight */
  tradeValue: { scoreWeight: 0.6, demandWeight: 3 },
};
