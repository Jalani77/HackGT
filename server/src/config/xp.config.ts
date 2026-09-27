import type { Rarity } from '../../../shared/rarity';

/** XP and level rules. All level math happens server-side in XPService. */
export const xpConfig = {
  discoveryByRarity: {
    COMMON: 25,
    UNCOMMON: 35,
    RARE: 50,
    EPIC: 100,
    LEGENDARY: 200,
    MYTHIC: 400,
  } as Record<Rarity, number>,
  /** Duplicates still pay out (they're trade fodder), just less. */
  duplicateMultiplier: 0.4,
  firstOnCampusBonus: 25,
  newCategoryBonus: 15,

  trade: 25,
  /** Defaults; each mission/event/route document can set its own reward XP. */
  missionComplete: 100,
  groupEvent: 250,
  /** Student-hosted events pay less than official ones (and never mint cards). */
  hostedEvent: 100,
  routeComplete: 150,
  /** Paid to a route's creator each time another student finishes it. */
  routeCreatorBonus: 20,

  /** Cumulative XP required to reach each level (index 0 = level 1). */
  levels: [
    { xp: 0, title: 'New Explorer' },
    { xp: 100, title: 'Campus Scout' },
    { xp: 250, title: 'Explorer' },
    { xp: 500, title: 'Collector' },
    { xp: 850, title: 'Community Explorer' },
    { xp: 1300, title: 'Campus Legend' },
    { xp: 1900, title: 'Trailblazer' },
    { xp: 2700, title: 'Curator' },
    { xp: 3700, title: 'Grand Naturalist' },
    { xp: 5000, title: 'Campus Mythmaker' },
    { xp: 6500, title: 'Wayfinder' },
    { xp: 8200, title: 'Keeper of the Quad' },
    { xp: 10200, title: 'Living Landmark' },
    { xp: 12500, title: 'Campus Oracle' },
    { xp: 15000, title: 'Legend of the Yellow Jacket' },
  ],
};
