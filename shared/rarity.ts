// Rarity tiers and their display metadata. Pure constants: the *rules* that
// assign a tier live server-side in server/src/config/rarity.config.ts.

export const RARITY_TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;
export type Rarity = (typeof RARITY_TIERS)[number];

export interface RarityDisplay {
  label: string;
  stars: number;
  color: string; // primary accent
  glow: string; // rgba glow used by reveal/effects
}

export const RARITY_DISPLAY: Record<Rarity, RarityDisplay> = {
  COMMON: { label: 'Common', stars: 1, color: '#9ca3af', glow: 'rgba(156,163,175,0.45)' },
  UNCOMMON: { label: 'Uncommon', stars: 2, color: '#34d399', glow: 'rgba(52,211,153,0.55)' },
  RARE: { label: 'Rare', stars: 3, color: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
  EPIC: { label: 'Epic', stars: 4, color: '#a78bfa', glow: 'rgba(167,139,250,0.7)' },
  LEGENDARY: { label: 'Legendary', stars: 5, color: '#fbbf24', glow: 'rgba(251,191,36,0.8)' },
  MYTHIC: { label: 'Mythic', stars: 6, color: '#f472b6', glow: 'rgba(244,114,182,0.9)' },
};

export const rarityRank = (r: Rarity) => RARITY_TIERS.indexOf(r);
