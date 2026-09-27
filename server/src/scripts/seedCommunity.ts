/**
 * TEST SEED DATA for Phases 4–5: missions, group events, rewards, routes, and the special
 * reward cards they pay out. Upserted by stable `key`, so re-seeding keeps real players'
 * progress attached. Everything is flagged `isSeed` and removed by `npm run seed -- --reset`.
 */
import { Types } from 'mongoose';
import type { MissionRequirements, EventKind } from '../../../shared/types';
import { Card } from '../models/Card';
import { CampusEvent } from '../models/Event';
import { Mission, MissionProgress } from '../models/Mission';
import { Redemption, Reward } from '../models/Reward';
import { Route, RouteRun } from '../models/Route';
import { OwnedCard } from '../models/OwnedCard';
import { User } from '../models/User';
import { newCheckInCode } from '../services/EventService';
import { SpecialCardService, type SpecialCardDef } from '../services/SpecialCardService';
import { toCanonicalKey } from '../utils/gameEnvironment';

const SPECIAL_CARDS: SpecialCardDef[] = [
  {
    key: 'campus-explorer',
    name: 'Campus Explorer',
    category: 'Other',
    description: 'Awarded to students who explored campus together on a Campus Discovery Walk.',
    funFact: "Georgia Tech's main campus covers roughly 400 acres in the middle of Atlanta.",
    tags: ['event', 'group'],
    source: 'event',
    earnHint: 'Check in at a Campus Discovery Walk with at least 3 explorers.',
    commonness: 3,
    flags: { isEvent: true, requiresGroup: true },
    maxTier: 'EPIC',
    motif: 'CE',
  },
  {
    key: 'golden-hour',
    name: 'Golden Hour',
    category: 'Nature',
    description: 'Earned by photographing campus at sunset with the Sunset Photo Meetup.',
    funFact: 'Photographers call the hour before sunset "golden hour" because the low sun gives warm, soft light.',
    tags: ['event', 'photo', 'sunset'],
    source: 'event',
    earnHint: 'Attend the Sunset Photo Meetup.',
    commonness: 2,
    flags: { isEvent: true, requiresGroup: true },
    maxTier: 'RARE',
    motif: 'GH',
  },
  {
    key: 'keeper-of-the-green',
    name: 'Keeper of the Green',
    category: 'Nature',
    description: 'For students who spent a morning making campus cleaner for everyone.',
    funFact: 'A plastic bottle can take hundreds of years to break down, so every piece picked up counts.',
    tags: ['event', 'charity', 'cleanup'],
    source: 'event',
    earnHint: 'Join the Campus Cleanup Crew with at least 5 volunteers.',
    commonness: 4,
    flags: { isEvent: true, requiresGroup: true },
    maxTier: 'LEGENDARY',
    motif: 'KG',
  },
  {
    key: 'yellow-jacket-spirit',
    name: 'Yellow Jacket Spirit',
    category: 'Other',
    description: 'The rarest card on campus. Only earned at the Homecoming Night Hunt.',
    funFact: 'Georgia Tech students have been called Yellow Jackets since the early 1900s.',
    tags: ['event', 'homecoming', 'mythic'],
    source: 'event',
    earnHint: 'Complete the Homecoming Night Hunt with 10+ explorers.',
    commonness: 5,
    flags: { isEvent: true, requiresGroup: true },
    maxTier: 'MYTHIC',
    motif: 'YJ',
  },
  {
    key: 'botanists-seal',
    name: "Botanist's Seal",
    category: 'Plant',
    description: 'Proof that you took the time to notice the plants everyone else walks past.',
    funFact: 'Scientists have catalogued more than 60,000 species of trees on Earth.',
    tags: ['mission', 'plants'],
    source: 'mission',
    earnHint: 'Complete the Nature Walk mission.',
    commonness: 3,
    flags: { requiresMission: true },
    maxTier: 'RARE',
    motif: 'BS',
  },
  {
    key: 'historic-trailblazer',
    name: 'Historic Trailblazer',
    category: 'Landmark',
    description: 'For walking the Historic Tech Trail from its first building to its Olympic-era icon.',
    funFact: 'Georgia Tech was founded in 1885, and its first classes began in 1888.',
    tags: ['route', 'history'],
    source: 'route',
    earnHint: 'Complete the Historic Tech Trail route.',
    commonness: 4,
    flags: { requiresMission: true },
    maxTier: 'EPIC',
    motif: 'HT',
  },
  {
    key: 'founders-medallion',
    name: "Founders' Medallion",
    category: 'Art',
    description: 'An exclusive collectible for the most dedicated explorers on campus.',
    funFact: 'Only students who reach the highest explorer level can ever hold this medallion.',
    tags: ['reward', 'exclusive'],
    source: 'reward',
    earnHint: 'Unlock at level 15 and redeem it from Rewards.',
    commonness: 5,
    maxTier: 'LEGENDARY',
    motif: 'FM',
  },
];

interface SeedMission {
  key: string;
  title: string;
  description: string;
  icon: string;
  requirements: MissionRequirements;
  minLevel: number;
  xp: number;
  card?: string;
}

const MISSIONS: SeedMission[] = [
  { key: 'first-discovery', title: 'First Discovery', icon: '🔍', description: "Photograph anything you haven't collected yet.", requirements: { objective: 'discover', count: 1, newCardsOnly: true }, minLevel: 1, xp: 50 },
  { key: 'nature-walk', title: 'Nature Walk', icon: '🌿', description: 'Discover 3 different plants around campus.', requirements: { objective: 'discover', count: 3, category: 'Plant', distinct: true }, minLevel: 1, xp: 150, card: 'botanists-seal' },
  { key: 'something-new', title: 'Something New', icon: '✨', description: "Discover 5 things you've never collected before.", requirements: { objective: 'discover', count: 5, newCardsOnly: true, distinct: true }, minLevel: 1, xp: 150 },
  { key: 'critter-spotter', title: 'Critter Spotter', icon: '🐾', description: 'Spot 2 different animals on campus.', requirements: { objective: 'discover', count: 2, category: 'Animal', distinct: true }, minLevel: 1, xp: 120 },
  { key: 'trade-partner', title: 'Trade Partner', icon: '🤝', description: 'Complete a trade with another student.', requirements: { objective: 'trade', count: 1 }, minLevel: 1, xp: 100 },
  { key: 'show-up', title: 'Show Up', icon: '🫂', description: 'Attend a group event and check in with the group.', requirements: { objective: 'attend_event', count: 1 }, minLevel: 1, xp: 150 },
  { key: 'landmark-hunter', title: 'Landmark Hunter', icon: '📍', description: 'Visit 3 different campus landmarks.', requirements: { objective: 'discover', count: 3, landmarkOnly: true, distinct: true }, minLevel: 2, xp: 200 },
  { key: 'trail-runner', title: 'Trail Runner', icon: '🥾', description: 'Complete an exploration route.', requirements: { objective: 'complete_route', count: 1 }, minLevel: 2, xp: 150 },
  { key: 'rare-finds', title: 'Rare Finds', icon: '💎', description: 'Discover something Rare or better.', requirements: { objective: 'discover', count: 1, minRarity: 'RARE' }, minLevel: 3, xp: 200 },
  { key: 'art-walk', title: 'Art Walk', icon: '🎨', description: 'Find 3 different works of public art.', requirements: { objective: 'discover', count: 3, category: 'Art', distinct: true }, minLevel: 4, xp: 200 },
  { key: 'social-butterfly', title: 'Social Butterfly', icon: '🦋', description: 'Complete 3 trades with other students.', requirements: { objective: 'trade', count: 3 }, minLevel: 5, xp: 250 },
];

interface SeedEvent {
  key: string;
  title: string;
  description: string;
  kind: EventKind;
  locationName: string;
  host: string;
  hostLabel: string;
  /** Start relative to now, or a day offset + local hour. */
  start: { minutesFromNow: number } | { daysFromNow: number; hour: number; minute?: number };
  durationMinutes: number;
  minParticipants: number;
  maxParticipants?: number;
  requiredDiscoveries: number;
  minLevel?: number;
  xp: number;
  card?: string;
  participants: { username: string; checkedIn?: boolean }[];
}

const EVENTS: SeedEvent[] = [
  {
    key: 'discovery-walk',
    title: 'Campus Discovery Walk',
    description:
      'Meet up and explore campus as a group. Once 3 explorers have checked in, make one discovery together and everyone earns the Campus Explorer card.',
    kind: 'walk',
    locationName: 'Tech Green, south steps',
    host: 'maya',
    hostLabel: 'Outdoor Rec Club',
    start: { minutesFromNow: -20 },
    durationMinutes: 240,
    minParticipants: 3,
    maxParticipants: 30,
    requiredDiscoveries: 1,
    xp: 250,
    card: 'campus-explorer',
    participants: [{ username: 'maya', checkedIn: true }, { username: 'jordan', checkedIn: true }, { username: 'priya' }],
  },
  {
    key: 'sunset-photos',
    title: 'Sunset Photo Meetup',
    description: 'Catch golden hour together. Photograph 2 things in the sunset light to earn the Golden Hour card.',
    kind: 'photo',
    locationName: 'Top of the Student Center steps',
    host: 'priya',
    hostLabel: 'Photo Society',
    start: { daysFromNow: 1, hour: 18, minute: 45 },
    durationMinutes: 90,
    minParticipants: 3,
    requiredDiscoveries: 2,
    xp: 200,
    card: 'golden-hour',
    participants: [{ username: 'priya' }, { username: 'alex' }, { username: 'sam' }],
  },
  {
    key: 'campus-cleanup',
    title: 'Campus Cleanup Crew',
    description: 'Gloves and bags provided. Spend a morning making campus nicer for everyone, then grab breakfast together.',
    kind: 'cleanup',
    locationName: 'Campus Recreation Center entrance',
    host: 'jordan',
    hostLabel: 'Students for Sustainability',
    start: { daysFromNow: 2, hour: 10 },
    durationMinutes: 120,
    minParticipants: 5,
    requiredDiscoveries: 0,
    xp: 250,
    card: 'keeper-of-the-green',
    participants: [{ username: 'jordan' }, { username: 'maya' }, { username: 'alex' }],
  },
  {
    key: 'tree-id-walk',
    title: 'Tree ID Walk',
    description: 'Learn to tell a live oak from a willow oak. Identify 3 trees with the Botany Club.',
    kind: 'walk',
    locationName: 'Kessler Campanile',
    host: 'alex',
    hostLabel: 'Botany Club',
    start: { daysFromNow: 3, hour: 16 },
    durationMinutes: 60,
    minParticipants: 3,
    requiredDiscoveries: 3,
    xp: 200,
    participants: [{ username: 'alex' }, { username: 'sam' }],
  },
  {
    key: 'homecoming-hunt',
    title: 'Homecoming Night Hunt',
    description: 'The biggest scavenger hunt of the year. Ten or more explorers, five discoveries each, one mythic card.',
    kind: 'scavenger',
    locationName: 'Bobby Dodd Stadium, Gate 1',
    host: 'maya',
    hostLabel: 'Student Government',
    start: { daysFromNow: 6, hour: 19 },
    durationMinutes: 180,
    minParticipants: 10,
    requiredDiscoveries: 5,
    minLevel: 3,
    xp: 400,
    card: 'yellow-jacket-spirit',
    participants: [{ username: 'maya' }, { username: 'priya' }, { username: 'jordan' }],
  },
];

const REWARDS = [
  { key: 'sticker-pack', title: 'Explorer sticker pack', partner: 'Campus Store (demo partner)', icon: '🏷️', type: 'deal', minLevel: 2, description: 'Show your code at the register for a free sticker pack.' },
  { key: 'gear-rental', title: 'Free day of gear rental', partner: 'Outdoor Rec (demo partner)', icon: '⛺', type: 'deal', minLevel: 3, description: 'One free day of camping or hiking gear rental.' },
  { key: 'cafe-10', title: '10% off at the campus café', partner: 'Campus Café (demo partner)', icon: '☕', type: 'deal', minLevel: 5, description: '10% off any drink or snack. Show your code at checkout.' },
  { key: 'event-entry', title: 'Free campus event entry', partner: 'Student Center (demo partner)', icon: '🎟️', type: 'entry', minLevel: 10, description: 'Free entry to one ticketed student event this semester.' },
  { key: 'founders-medallion', title: "Founders' Medallion", partner: 'Campus Quest', icon: '🏅', type: 'collectible', minLevel: 15, description: 'An exclusive Legendary collectible for campus legends.', card: 'founders-medallion' },
] as const;

interface SeedRoute {
  key: string;
  title: string;
  description: string;
  creator: string | null;
  checkpoints: { label: string; hint?: string; area?: string; card?: string; category?: MissionRequirements['category'] }[];
  distanceM: number;
  estMinutes: number;
  xp: number;
  rewardCard?: string;
  completions: number;
}

const ROUTES: SeedRoute[] = [
  {
    key: 'historic-tech-trail',
    title: 'Historic Tech Trail',
    description: "Walk through Georgia Tech history, from its first academic building to its Olympic-era icon.",
    creator: null,
    checkpoints: [
      { label: 'Tech Tower', card: 'Tech Tower', area: 'North Ave & Cherry St', hint: 'Look up for the glowing TECH sign.' },
      { label: 'Kessler Campanile', card: 'Kessler Campanile', area: 'Tech Walkway', hint: 'The steel spire at the heart of campus.' },
      { label: 'A historic building', category: 'Architecture', hint: 'Any building with some history to it.' },
      { label: 'Something growing on Tech Green', category: 'Plant', area: 'Tech Green' },
    ],
    distanceM: 1400,
    estMinutes: 35,
    xp: 200,
    rewardCard: 'historic-trailblazer',
    completions: 3,
  },
  {
    key: 'green-loop',
    title: 'The Green Loop',
    description: 'A relaxed loop past campus trees and the bugs that love them.',
    creator: 'priya',
    checkpoints: [
      { label: 'Southern Magnolia', card: 'Southern Magnolia', hint: 'Big glossy leaves, huge white flowers.' },
      { label: 'Carpenter Bee', card: 'Carpenter Bee', hint: 'Check sunny wooden railings.' },
      { label: 'Any other plant', category: 'Plant' },
      { label: 'A campus critter', category: 'Animal', hint: 'Squirrels and birds count!' },
    ],
    distanceM: 900,
    estMinutes: 20,
    xp: 150,
    completions: 1,
  },
  {
    key: 'study-break',
    title: 'Ten-Minute Study Break',
    description: 'Stuck in the library? Step outside and find three things before you go back in.',
    creator: 'jordan',
    checkpoints: [
      { label: 'Anything that catches your eye' },
      { label: 'Something growing', category: 'Plant' },
      { label: 'Something useful', category: 'Object', hint: 'Bike racks, blue-light phones, benches…' },
    ],
    distanceM: 400,
    estMinutes: 10,
    xp: 150,
    completions: 0,
  },
];

function startTime(start: SeedEvent['start']): Date {
  if ('minutesFromNow' in start) return new Date(Date.now() + start.minutesFromNow * 60_000);
  const d = new Date();
  d.setDate(d.getDate() + start.daysFromNow);
  d.setHours(start.hour, start.minute ?? 0, 0, 0);
  return d;
}

export async function seedCommunity(campusId: string, users: Map<string, { _id: Types.ObjectId }>) {
  const idOf = (username: string) => {
    const u = users.get(username);
    if (!u) throw new Error(`seed user "${username}" missing`);
    return u._id;
  };

  // Special cards (organizer-defined rewards).
  const special = new Map<string, Types.ObjectId>();
  for (const def of SPECIAL_CARDS) {
    const card = await SpecialCardService.ensure(campusId, def, { isSeed: true });
    special.set(def.key, card._id);
  }
  const specialId = (key?: string) => (key ? special.get(key)! : null);

  for (const [i, m] of MISSIONS.entries()) {
    await Mission.updateOne(
      { campusId, key: m.key },
      {
        $set: {
          title: m.title,
          description: m.description,
          icon: m.icon,
          requirements: {
            category: null,
            minRarity: null,
            landmarkOnly: false,
            newCardsOnly: false,
            distinct: false,
            ...m.requirements,
          },
          minLevel: m.minLevel,
          reward: { xp: m.xp, cardId: specialId(m.card) },
          active: true,
          sortOrder: i,
          isSeed: true,
        },
      },
      { upsert: true },
    );
  }

  const codes: string[] = [];
  for (const e of EVENTS) {
    const startsAt = startTime(e.start);
    const code = newCheckInCode();
    codes.push(`${e.title}: ${code}  (host: ${e.host})`);
    await CampusEvent.updateOne(
      { campusId, key: e.key },
      {
        $set: {
          title: e.title,
          description: e.description,
          kind: e.kind,
          locationName: e.locationName,
          hostId: idOf(e.host),
          hostLabel: e.hostLabel,
          official: true,
          startsAt,
          endsAt: new Date(startsAt.getTime() + e.durationMinutes * 60_000),
          minParticipants: e.minParticipants,
          maxParticipants: e.maxParticipants ?? null,
          requiredDiscoveries: e.requiredDiscoveries,
          minLevel: e.minLevel ?? 1,
          reward: { xp: e.xp, cardId: specialId(e.card) },
          checkInCode: code,
          // Re-seeding reschedules the event, so the guest list starts over.
          participants: e.participants.map((p) => ({
            userId: idOf(p.username),
            joinedAt: new Date(Date.now() - 36e5),
            checkedInAt: p.checkedIn ? new Date(Math.min(Date.now(), startsAt.getTime()) - 5 * 60_000) : null,
            rewardedAt: null,
          })),
          isSeed: true,
        },
      },
      { upsert: true },
    );
  }

  for (const r of REWARDS) {
    await Reward.updateOne(
      { campusId, key: r.key },
      {
        $set: {
          title: r.title,
          partner: r.partner,
          description: r.description,
          icon: r.icon,
          type: r.type,
          minLevel: r.minLevel,
          cardId: 'card' in r ? specialId(r.card) : null,
          active: true,
          isSeed: true,
        },
      },
      { upsert: true },
    );
  }

  const cardByName = async (name: string) =>
    (await Card.findOne({ campusId, canonicalKey: toCanonicalKey(name) }).select('_id'))?._id ?? null;
  for (const r of ROUTES) {
    const checkpoints = [];
    for (const [order, c] of r.checkpoints.entries()) {
      const cardId = c.card ? await cardByName(c.card) : null;
      // If a named card is missing, fall back to "anything" rather than an unreachable checkpoint.
      checkpoints.push({ order, label: c.label, hint: c.hint ?? '', area: c.area ?? '', cardId, category: cardId ? null : (c.category ?? null) });
    }
    await Route.updateOne(
      { campusId, key: r.key },
      {
        $set: {
          title: r.title,
          description: r.description,
          creatorId: r.creator ? idOf(r.creator) : null,
          official: !r.creator,
          checkpoints,
          distanceM: r.distanceM,
          estMinutes: r.estMinutes,
          reward: { xp: r.xp, cardId: specialId(r.rewardCard) },
          'stats.completions': r.completions,
          'stats.starts': r.completions + 2,
          active: true,
          isSeed: true,
        },
      },
      { upsert: true },
    );
    if (r.creator) await User.updateOne({ _id: idOf(r.creator) }, { $inc: { 'stats.routesCreated': 1 } });
  }

  console.log(
    `[seed] community: ${SPECIAL_CARDS.length} special cards, ${MISSIONS.length} missions, ${EVENTS.length} events, ` +
      `${REWARDS.length} rewards, ${ROUTES.length} routes`,
  );
  console.log(`[seed] event check-in codes (hosts also see them in the app):\n        ${codes.join('\n        ')}`);
}

/** Remove seed players' community activity (keeps content so real players' progress survives). */
export async function removeSeedPlayerActivity(userIds: Types.ObjectId[]) {
  await Promise.all([
    MissionProgress.deleteMany({ userId: { $in: userIds } }),
    RouteRun.deleteMany({ userId: { $in: userIds } }),
    Redemption.deleteMany({ userId: { $in: userIds } }),
    CampusEvent.updateMany({}, { $pull: { participants: { userId: { $in: userIds } } } }),
  ]);
}

/** --reset: remove all seeded community content. Special cards real players own are kept. */
export async function removeSeedContent() {
  const [missions, routes, rewards] = await Promise.all([
    Mission.find({ isSeed: true }).select('_id'),
    Route.find({ isSeed: true }).select('_id'),
    Reward.find({ isSeed: true }).select('_id'),
  ]);
  await Promise.all([
    MissionProgress.deleteMany({ missionId: { $in: missions.map((m) => m._id) } }),
    RouteRun.deleteMany({ routeId: { $in: routes.map((r) => r._id) } }),
    Redemption.deleteMany({ rewardId: { $in: rewards.map((r) => r._id) } }),
    Mission.deleteMany({ isSeed: true }),
    Route.deleteMany({ isSeed: true }),
    Reward.deleteMany({ isSeed: true }),
    CampusEvent.deleteMany({ isSeed: true }),
  ]);
  let kept = 0;
  for (const card of await Card.find({ isSeed: true, source: { $ne: 'discovery' } }).select('_id')) {
    if (await OwnedCard.exists({ cardId: card._id })) kept++;
    else await Card.deleteOne({ _id: card._id });
  }
  console.log(`[seed] removed seeded missions, events, rewards, routes${kept ? ` (kept ${kept} special cards players own)` : ''}`);
}
