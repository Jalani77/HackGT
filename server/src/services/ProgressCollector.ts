import type { Types } from 'mongoose';
import type { Rarity } from '../../../shared/rarity';
import type {
  AchievementDTO,
  CardCategory,
  GrantedReward,
  MissionTick,
  ProgressUpdate,
  RouteTick,
} from '../../../shared/types';

/**
 * Something a player did that missions, routes, events, and achievements may react to.
 * `key` uniquely identifies the activity so it can never count twice toward the same goal.
 */
export type Activity =
  | {
      type: 'discovery';
      key: string;
      discoveryId: Types.ObjectId;
      cardId: Types.ObjectId;
      category: CardCategory;
      rarity: Rarity;
      isLandmark: boolean;
      /** The player didn't own this card before this discovery. */
      isNewCard: boolean;
      at: Date;
    }
  | { type: 'trade'; key: string }
  | { type: 'event_attended'; key: string; eventId: Types.ObjectId }
  | { type: 'route_completed'; key: string; routeId: Types.ObjectId };

export const emptyProgress = (): ProgressUpdate => ({ missions: [], routes: [], achievements: [], rewards: [], xp: 0 });

/** Accumulates everything one action advanced, for the response and the reveal UI. */
export class ProgressCollector {
  private missions = new Map<string, MissionTick>();
  private routes = new Map<string, RouteTick>();
  private achievements: AchievementDTO[] = [];
  private rewards: GrantedReward[] = [];
  private followUps: Activity[] = [];
  private xp = 0;

  mission(tick: MissionTick) {
    this.missions.set(tick.missionId, tick); // latest state wins if a mission advances twice
  }
  route(tick: RouteTick) {
    this.routes.set(tick.routeId, tick);
  }
  achievement(a: AchievementDTO) {
    this.achievements.push(a);
    this.xp += a.xp;
  }
  reward(g: GrantedReward) {
    this.rewards.push(g);
    this.xp += g.xp;
  }
  /** Queue an activity caused by this one (finishing a route counts toward route missions). */
  followUp(a: Activity) {
    this.followUps.push(a);
  }
  drainFollowUps(): Activity[] {
    return this.followUps.splice(0);
  }

  toUpdate(): ProgressUpdate {
    return {
      missions: [...this.missions.values()],
      routes: [...this.routes.values()],
      achievements: this.achievements,
      rewards: this.rewards,
      xp: this.xp,
    };
  }
}
