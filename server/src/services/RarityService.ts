import { rarityRank, type Rarity } from '../../../shared/rarity';
import type { CardCategory, Season } from '../../../shared/types';
import { rarityConfig as cfg } from '../config/rarity.config';

export interface RarityInput {
  commonness: 1 | 2 | 3 | 4 | 5;
  category: CardCategory;
  /** Discoveries of this card on this campus *before* the current one. */
  priorDiscoveries: number;
  confidence: number;
  isLandmark: boolean;
  isEvent?: boolean;
  requiresGroup?: boolean;
  requiresMission?: boolean;
  seasonal?: string[];
  currentSeason?: Season;
  /** Cap for this source; ordinary discoveries use cfg.maxTierForDiscovery. */
  maxTier?: Rarity;
}

export interface RarityResult {
  rarity: Rarity;
  rarityScore: number;
  factors: { reason: string; points: number }[];
}

/** Deterministic, explainable rarity. Rules live in config/rarity.config.ts. */
export const RarityService = {
  score(input: RarityInput): RarityResult {
    const factors: RarityResult['factors'] = [];
    const add = (reason: string, points: number) => points && factors.push({ reason, points });

    add('commonness', cfg.commonnessBase[input.commonness]);
    add(
      'campus scarcity',
      Math.round(cfg.scarcity.maxBonus / (1 + input.priorDiscoveries / cfg.scarcity.halfLife)),
    );
    if (input.isLandmark) add('landmark', cfg.bonuses.landmark);
    add('category', cfg.category[input.category] ?? 0);
    if (input.isEvent) add('event', cfg.bonuses.event);
    if (input.requiresGroup) add('group', cfg.bonuses.requiresGroup);
    if (input.requiresMission) add('mission', cfg.bonuses.requiresMission);
    if (input.currentSeason && input.seasonal?.includes(input.currentSeason)) add('in season', cfg.bonuses.inSeason);
    if (input.confidence < cfg.lowConfidence.threshold) add('low confidence', -cfg.lowConfidence.penalty);

    const rarityScore = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
    let rarity = cfg.tiers.find((t) => rarityScore >= t.min)!.tier;

    const cap = input.maxTier ?? cfg.maxTierForDiscovery;
    if (rarityRank(rarity) > rarityRank(cap)) rarity = cap;

    return { rarity, rarityScore, factors };
  },

  tradeValue(rarityScore: number, wantedBy: number): number {
    return Math.round(rarityScore * cfg.tradeValue.scoreWeight + wantedBy * cfg.tradeValue.demandWeight);
  },
};
