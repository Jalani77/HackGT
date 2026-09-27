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
export type CardSource = 'discovery' | 'event' | 'mission' | 'route' | 'reward';
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
  stats: {
    discoveries: number;
    cardsOwned: number;
    uniqueCards: number;
    trades: number;
    missionsCompleted: number;
    eventsAttended: number;
    routesCompleted: number;
  };
  /** Pending trade offers waiting on this user (only populated for yourself). */
  notifications: { incomingTrades: number };
  /** What the HUD should nudge you toward next (only populated for yourself). */
  objective: ObjectiveDTO | null;
  createdAt: string;
}

export interface ObjectiveDTO {
  kind: 'mission' | 'route' | 'event';
  id: string;
  icon: string;
  label: string;
  progress: number;
  target: number;
}

export interface LevelUpDTO {
  from: number;
  to: number;
  title: string;
  /** Human-readable things this level-up unlocked (missions, events, deals, features). */
  unlocks: string[];
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
  /** For special cards: how to earn it ("Attend the Campus Discovery Walk"). Null for photo discoveries. */
  earnHint: string | null;
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
  achievements: AchievementDTO[];
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
  levelUp: LevelUpDTO | null;
  /** Missions, routes, events, and achievements this discovery advanced. */
  progress: ProgressUpdate;
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
  levelUp: LevelUpDTO | null;
  progress: ProgressUpdate;
  player: PublicUser;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

// ─── Progress & rewards (Phase 4) ────────────────────────────────

/** A reward moment: a mission/event/route/level reward paid out to the player. */
export interface GrantedReward {
  source: 'mission' | 'event' | 'route' | 'reward';
  sourceId: string;
  title: string; // "Nature Walk"
  headline: string; // "MISSION COMPLETE!"
  xp: number;
  card: CardDTO | null;
  copy: OwnedCardDTO | null;
}

export interface MissionTick {
  missionId: string;
  title: string;
  icon: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface RouteTick {
  routeId: string;
  title: string;
  checkpoint: string;
  done: number;
  total: number;
  completed: boolean;
}

/** Everything an action advanced. Returned with discoveries, trades, check-ins, redemptions. */
export interface ProgressUpdate {
  missions: MissionTick[];
  routes: RouteTick[];
  achievements: AchievementDTO[];
  rewards: GrantedReward[];
  /** Total bonus XP from the above (not including the action's own XP). */
  xp: number;
}

/** Result of an action whose main effect is progress (check-in, redemption, route start). */
export interface ActionResult<T> {
  data: T;
  progress: ProgressUpdate;
  levelUp: LevelUpDTO | null;
  player: PublicUser;
}

export interface AchievementDTO {
  key: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  progress: number;
  target: number;
  unlockedAt: string | null;
}

// ─── Missions ────────────────────────────────────────────────────

export const MISSION_OBJECTIVES = ['discover', 'trade', 'attend_event', 'complete_route'] as const;
export type MissionObjective = (typeof MISSION_OBJECTIVES)[number];

export interface MissionRequirements {
  objective: MissionObjective;
  count: number;
  /** discover only: filters on what counts. */
  category?: CardCategory | null;
  minRarity?: Rarity | null;
  landmarkOnly?: boolean;
  /** Only cards you didn't own before. */
  newCardsOnly?: boolean;
  /** Count different cards, not repeat photos of the same thing. */
  distinct?: boolean;
}

export type MissionStatus = 'locked' | 'available' | 'active' | 'completed';

export interface MissionDTO {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirements: MissionRequirements;
  minLevel: number;
  reward: { xp: number; card: CardMini | null };
  endsAt: string | null;
  status: MissionStatus;
  progress: number;
  completedAt: string | null;
}

// ─── Group events ────────────────────────────────────────────────

export const EVENT_KINDS = ['walk', 'tour', 'scavenger', 'cleanup', 'photo', 'social', 'charity', 'other'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventStatus = 'upcoming' | 'live' | 'ended';

export interface EventDTO {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  /** Public meeting spot (e.g. "Tech Green, by the fountain"). Never a person's location. */
  locationName: string;
  host: StudentSummary | null;
  hostLabel: string; // organization / club name
  official: boolean;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  minParticipants: number;
  maxParticipants: number | null;
  /** Discoveries each participant must make after checking in. */
  requiredDiscoveries: number;
  minLevel: number;
  going: number;
  checkedIn: number;
  /** True once enough people have checked in for the group reward. */
  groupUnlocked: boolean;
  attendees: StudentSummary[];
  reward: { xp: number; card: CardMini | null };
  me: {
    joined: boolean;
    checkedIn: boolean;
    rewarded: boolean;
    isHost: boolean;
    discoveriesSinceCheckIn: number;
  };
  /** Only sent to the host. They share it in person so check-ins mean "actually here". */
  checkInCode: string | null;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  kind: EventKind;
  locationName: string;
  hostLabel?: string;
  startsAt: string;
  durationMinutes: number;
  minParticipants: number;
  maxParticipants?: number | null;
  requiredDiscoveries?: number;
}

// ─── Routes (Phase 5) ────────────────────────────────────────────

export interface RouteCheckpointDTO {
  order: number;
  label: string;
  hint: string;
  /** Public landmark-level area ("North Ave side of Tech Green"). */
  area: string;
  /** Exactly one of: a specific card, a category, or neither (= photograph anything). */
  card: CardMini | null;
  category: CardCategory | null;
}

export type RouteDifficulty = 'easy' | 'moderate' | 'hard';

export interface RouteRunDTO {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  done: number;
  startedAt: string;
  completedAt: string | null;
}

export interface RouteDTO {
  id: string;
  title: string;
  description: string;
  creator: StudentSummary | null;
  official: boolean;
  checkpoints: RouteCheckpointDTO[];
  distanceM: number | null;
  estMinutes: number | null;
  difficulty: RouteDifficulty;
  reward: { xp: number; card: CardMini | null };
  stats: { starts: number; completions: number };
  myRun: RouteRunDTO | null;
  /** Whether you've ever finished it (the reward pays out once). */
  completedByMe: boolean;
  createdAt: string;
}

export interface CreateRouteRequest {
  title: string;
  description?: string;
  checkpoints: { label: string; hint?: string; area?: string; cardId?: string | null; category?: CardCategory | null }[];
  distanceM?: number | null;
  estMinutes?: number | null;
}

// ─── Rewards / student deals ─────────────────────────────────────

export type RewardType = 'deal' | 'entry' | 'collectible';

export interface RewardDTO {
  id: string;
  title: string;
  partner: string;
  description: string;
  icon: string;
  type: RewardType;
  minLevel: number;
  unlocked: boolean;
  card: CardMini | null;
  expiresAt: string | null;
  redemption: { code: string; redeemedAt: string } | null;
}

export interface RedeemResult {
  reward: RewardDTO;
  grant: GrantedReward | null;
}
