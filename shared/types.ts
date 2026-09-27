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
  /** Pending trade offers waiting on this user (only populated for yourself). */
  notifications: { incomingTrades: number };
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
  imageCredit: { author: string; license: string; sourceUrl: string } | null;
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

/** Fields a player may change on their own copy. Everything else is server-controlled. */
export interface CopyPatch {
  tradable?: boolean;
  favorite?: boolean;
}

export interface RecentDiscovery {
  id: string;
  cardId: string;
  name: string;
  category: CardCategory;
  photoUrl: string;
  xpAwarded: number;
  isDuplicate: boolean;
  createdAt: string;
}

export interface ProfileResponse {
  user: PublicUser;
  isMe: boolean;
  rarestCard: CollectionEntry | null;
  favorites: CollectionEntry[];
  tradableCount: number;
  categories: { category: CardCategory; count: number }[];
  recentDiscoveries: RecentDiscovery[];
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
  | 'UNAVAILABLE'
  | 'INTERNAL';

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

// ─── Social / trading ────────────────────────────────────────────

export interface CardMini {
  id: string;
  name: string;
  rarity: Rarity;
  imageUrl: string;
}

export interface StudentSummary {
  id: string;
  username: string;
  displayName: string;
  level: number;
  levelTitle: string;
}

/** A student in the directory, with trade matches relative to the viewer. */
export interface StudentListItem extends StudentSummary {
  wishlistCount: number;
  tradableCount: number;
  /** Cards on their wishlist that the viewer has tradable copies of. */
  theyWantFromMe: CardMini[];
  /** Cards on the viewer's wishlist that they have tradable copies of. */
  iWantFromThem: CardMini[];
}

export interface WishlistEntry {
  card: CardDTO;
  /** Whether the wishlist owner already has a copy. */
  ownedByUser: boolean;
  /** How many tradable copies the *viewer* has (lets you spot "I can help!"). */
  viewerTradableCopies: number;
  /** How many other students have tradable copies (for your own wishlist). */
  tradableElsewhere: number;
}

export interface CardSocial {
  inMyWishlist: boolean;
  wantedBy: StudentSummary[];
  tradableBy: (StudentSummary & { copies: number })[];
}

export type TradeStatus = 'pending' | 'processing' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface TradeItemDTO {
  copyId: string;
  card: CardMini;
}

export interface TradeDTO {
  id: string;
  direction: 'incoming' | 'outgoing';
  from: StudentSummary;
  to: StudentSummary;
  offered: TradeItemDTO[];
  requested: TradeItemDTO[];
  message: string;
  status: TradeStatus;
  statusReason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateTradeRequest {
  toUserId: string;
  offeredCopyIds: string[];
  requestedCopyIds: string[];
  message?: string;
}

export interface TradeAcceptResult {
  trade: TradeDTO;
  xpAwarded: number;
  levelUp: { from: number; to: number; title: string } | null;
  player: PublicUser;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}
