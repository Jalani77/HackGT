// API contract shared by client and server. Types only — no business logic.
import type { Rarity } from './rarity';
export type { Rarity } from './rarity';

export const CARD_CATEGORIES = [
  'Plant',
  'Animal',
  'Insect',
  'Architecture',
  'Landmark',
  'Art',
  'Sign',
  'Food',
  'Object',
  'Nature',
  'Other',
] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export type CardSource = 'discovery' | 'event' | 'mission' | 'route';
export type AcquiredVia = 'discovery' | 'trade' | 'reward' | 'event';

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  currentLevelXp: number; // xp threshold of current level
  nextLevelXp: number | null; // null at max level
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  campusId: string;
  level: LevelInfo;
  stats: { discoveries: number; cardsOwned: number; uniqueCards: number; trades: number };
  createdAt: string;
}

export interface CardDTO {
  id: string;
  campusId: string;
  name: string;
  category: CardCategory;
  description: string;
  funFact: string;
  tags: string[];
  imageUrl: string;
  rarity: Rarity;
  rarityScore: number;
  tradeValue: number;
  flags: { isLandmark: boolean; isEvent: boolean; requiresGroup: boolean; requiresMission: boolean };
  stats: { discoveryCount: number; uniqueDiscoverers: number; wantedBy: number };
  firstDiscoveredBy: { id: string; username: string } | null;
  source: CardSource;
  createdAt: string;
}

/** One copy of a card held by a user. Duplicates are separate copies. */
export interface OwnedCardDTO {
  id: string;
  cardId: string;
  ownerId: string;
  imageUrl: string;
  acquiredVia: AcquiredVia;
  tradable: boolean;
  favorite: boolean;
  acquiredAt: string;
  xpAwarded: number;
  environment: { season: Season; timeOfDay: TimeOfDay } | null;
}

/** A card grouped with all of the user's copies of it. */
export interface CollectionEntry {
  card: CardDTO;
  copies: OwnedCardDTO[];
}

export interface CollectionResponse {
  entries: CollectionEntry[];
  totals: { uniqueOwned: number; copies: number; catalogSize: number; completion: number };
}

export interface DiscoveryResult {
  discoveryId: string;
  card: CardDTO;
  copy: OwnedCardDTO;
  isDuplicate: boolean;
  isFirstOnCampus: boolean;
  lowConfidence: boolean;
  confidence: number;
  xp: { awarded: number; breakdown: { reason: string; amount: number }[] };
  levelUp: { from: number; to: number; title: string } | null;
  player: PublicUser;
  aiProvider: string;
}

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_IMAGE'
  | 'LOW_CONFIDENCE'
  | 'NOT_IDENTIFIED'
  | 'PERSON_DETECTED'
  | 'AI_FAILURE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}
