/**
 * Achievement definitions. Each one unlocks when a player metric reaches `target`.
 * Metrics are computed server-side in AchievementService; add a badge by adding a row.
 */
export type AchievementMetric =
  | 'discoveries'
  | 'uniqueCards'
  | 'categories'
  | 'firstOnCampus'
  | 'epicCards'
  | 'trades'
  | 'missionsCompleted'
  | 'eventsAttended'
  | 'routesCompleted'
  | 'routesCreated';

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  metric: AchievementMetric;
  target: number;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first-steps', title: 'First Steps', description: 'Make your first discovery.', icon: '👣', metric: 'discoveries', target: 1, xp: 10 },
  { key: 'curious-mind', title: 'Curious Mind', description: 'Make 10 discoveries.', icon: '🔭', metric: 'discoveries', target: 10, xp: 50 },
  { key: 'collector', title: 'Collector', description: 'Own 10 different cards.', icon: '🃏', metric: 'uniqueCards', target: 10, xp: 75 },
  { key: 'renaissance', title: 'Renaissance Explorer', description: 'Discover things in 5 different categories.', icon: '🌈', metric: 'categories', target: 5, xp: 75 },
  { key: 'pioneer', title: 'Pioneer', description: 'Be the first on campus to discover something.', icon: '🏆', metric: 'firstOnCampus', target: 1, xp: 25 },
  { key: 'treasure-hunter', title: 'Treasure Hunter', description: 'Own an Epic card or better.', icon: '💎', metric: 'epicCards', target: 1, xp: 50 },
  { key: 'fair-trade', title: 'Fair Trade', description: 'Complete a trade with another student.', icon: '🤝', metric: 'trades', target: 1, xp: 25 },
  { key: 'dealmaker', title: 'Dealmaker', description: 'Complete 5 trades.', icon: '💼', metric: 'trades', target: 5, xp: 75 },
  { key: 'on-a-mission', title: 'On a Mission', description: 'Complete a mission.', icon: '🎯', metric: 'missionsCompleted', target: 1, xp: 25 },
  { key: 'mission-specialist', title: 'Mission Specialist', description: 'Complete 5 missions.', icon: '🎖️', metric: 'missionsCompleted', target: 5, xp: 100 },
  { key: 'community-member', title: 'Community Member', description: 'Attend a group event.', icon: '🫂', metric: 'eventsAttended', target: 1, xp: 50 },
  { key: 'regular', title: 'Regular', description: 'Attend 3 group events.', icon: '🎪', metric: 'eventsAttended', target: 3, xp: 100 },
  { key: 'trail-finisher', title: 'Trail Finisher', description: 'Complete an exploration route.', icon: '🥾', metric: 'routesCompleted', target: 1, xp: 50 },
  { key: 'trailblazer', title: 'Trailblazer', description: 'Publish a route for other students.', icon: '🗺️', metric: 'routesCreated', target: 1, xp: 25 },
];
