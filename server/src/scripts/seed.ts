/**
 * TEST SEED DATA: fake students, cards, and collections so social features have
 * something to show. Everything created here is flagged `isSeed: true`.
 *
 *   npm run seed            → replace existing seed data with a fresh set
 *   npm run seed -- --reset → remove all seed data and exit
 *
 * The discovery pipeline does not depend on any of this. Real cards are only created
 * by photographing things. The live-demo subject (Southern Live Oak) is intentionally NOT seeded.
 */
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { RARITY_DISPLAY } from '../../../shared/rarity';
import type { CardCategory, Season, TimeOfDay } from '../../../shared/types';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { Card, type CardDoc } from '../models/Card';
import { Discovery } from '../models/Discovery';
import { OwnedCard } from '../models/OwnedCard';
import { User } from '../models/User';
import { RarityService } from '../services/RarityService';
import { storageService } from '../services/storage';
import { XPService } from '../services/XPService';
import { toCanonicalKey } from '../utils/gameEnvironment';

const SEED_PASSWORD = 'password123';

interface SeedCard {
  name: string;
  category: CardCategory;
  commonness: 1 | 2 | 3 | 4 | 5;
  isLandmark?: boolean;
  description: string;
  funFact: string;
  tags: string[];
}

const CARDS: SeedCard[] = [
  {
    name: 'Tech Tower',
    category: 'Landmark',
    commonness: 5,
    isLandmark: true,
    description: 'The 1888 Romanesque Revival academic building topped by the iconic lit-up "TECH" sign.',
    funFact: 'Stealing the "T" from Tech Tower was a legendary student prank until it was officially banned in 1999.',
    tags: ['history', 'architecture', 'icon'],
  },
  {
    name: 'Kessler Campanile',
    category: 'Landmark',
    commonness: 5,
    isLandmark: true,
    description: 'An 80-foot stainless-steel spire at the heart of campus, built for the 1996 Olympics era.',
    funFact: 'The Campanile appears in the Georgia Tech logo used on countless diplomas and banners.',
    tags: ['sculpture', 'steel', 'icon'],
  },
  {
    name: 'Northern Cardinal',
    category: 'Animal',
    commonness: 2,
    description: 'A bright red songbird with a pointed crest, common across the eastern United States.',
    funFact: 'Male cardinals feed seeds to females beak-to-beak during courtship. It looks like a kiss!',
    tags: ['bird', 'songbird', 'red'],
  },
  {
    name: 'Eastern Chipmunk',
    category: 'Animal',
    commonness: 3,
    description: 'A small striped ground squirrel that stuffs its cheek pouches with seeds and nuts.',
    funFact: 'A chipmunk can gather up to 165 acorns in a single day.',
    tags: ['mammal', 'rodent'],
  },
  {
    name: 'Crape Myrtle',
    category: 'Plant',
    commonness: 1,
    description: 'A flowering tree famous for long-lasting summer blooms and smooth, peeling bark.',
    funFact: 'Crape myrtles are nicknamed "the lilac of the South" and can bloom for over 100 days.',
    tags: ['tree', 'flowering'],
  },
  {
    name: 'Southern Magnolia',
    category: 'Plant',
    commonness: 2,
    description: 'An evergreen tree with glossy leaves and huge, fragrant white flowers.',
    funFact: 'Magnolias evolved before bees existed, so beetles were their original pollinators.',
    tags: ['tree', 'flowering', 'evergreen'],
  },
  {
    name: 'Carpenter Bee',
    category: 'Insect',
    commonness: 3,
    description: 'A large, shiny-bodied bee that bores perfectly round nesting tunnels in wood.',
    funFact: 'Male carpenter bees can be territorial and buzz at you, but they have no stinger.',
    tags: ['bee', 'pollinator'],
  },
  {
    name: 'Emergency Blue Light Phone',
    category: 'Object',
    commonness: 2,
    description: 'A campus safety call box topped with a blue light that connects directly to campus police.',
    funFact: 'The blue lights are placed so that from any one of them, you can usually see the next.',
    tags: ['safety', 'campus'],
  },
  {
    name: 'Bike Rack',
    category: 'Object',
    commonness: 1,
    description: 'A metal rack for locking bicycles, one of the most common sights on any campus.',
    funFact: 'The classic "inverted U" rack supports a bike at two points, making it harder to tip over.',
    tags: ['bike', 'transport'],
  },
  {
    name: 'Street Mural',
    category: 'Art',
    commonness: 4,
    description: 'A large painted artwork covering an outdoor wall near campus.',
    funFact: 'Atlanta’s Krog Street Tunnel has been continuously repainted by artists for decades.',
    tags: ['art', 'mural', 'painting'],
  },
];

interface SeedStudent {
  username: string;
  displayName: string;
  xp: number;
  /** [card index, copies, tradable copies, favorite?] */
  owns: [number, number, number, boolean?][];
  wishlist: number[];
}

const STUDENTS: SeedStudent[] = [
  {
    username: 'jordan',
    displayName: 'Jordan',
    xp: 620,
    owns: [[0, 1, 0, true], [2, 2, 1], [4, 3, 2], [8, 2, 1], [6, 1, 0]],
    wishlist: [5, 9],
  },
  {
    username: 'maya',
    displayName: 'Maya',
    xp: 940,
    owns: [[1, 1, 0, true], [5, 2, 1], [3, 1, 0], [9, 1, 0, true], [7, 2, 1]],
    wishlist: [0, 6],
  },
  {
    username: 'alex',
    displayName: 'Alex',
    xp: 280,
    owns: [[4, 2, 1], [8, 1, 0], [7, 1, 0]],
    wishlist: [0, 1, 2],
  },
  {
    username: 'priya',
    displayName: 'Priya',
    xp: 1420,
    owns: [[0, 2, 1], [1, 1, 0], [6, 2, 1, true], [3, 2, 1], [5, 1, 0]],
    wishlist: [9],
  },
  {
    username: 'sam',
    displayName: 'Sam',
    xp: 130,
    owns: [[2, 1, 0], [8, 2, 1]],
    wishlist: [3, 5, 0],
  },
];

async function removeSeed() {
  const seedUsers = await User.find({ isSeed: true }).select('_id').lean();
  const ids = seedUsers.map((u) => u._id);
  const seedCardIds = (await Card.find({ isSeed: true }).select('_id').lean()).map((c) => c._id);
  // Real players may have seed cards on their wishlist.
  await User.updateMany({ wishlist: { $in: seedCardIds } }, { $pull: { wishlist: { $in: seedCardIds } } });
  const [d, o, c, u] = await Promise.all([
    Discovery.deleteMany({ userId: { $in: ids } }),
    OwnedCard.deleteMany({ $or: [{ isSeed: true }, { ownerId: { $in: ids } }] }),
    Card.deleteMany({ isSeed: true }),
    User.deleteMany({ isSeed: true }),
  ]);
  console.log(
    `[seed] removed ${u.deletedCount} users, ${c.deletedCount} cards, ${o.deletedCount} copies, ${d.deletedCount} discoveries`,
  );
}

/** Generated card art so seed data works offline and is obviously not a real photo. */
async function cardArt(card: SeedCard, color: string): Promise<Buffer> {
  const initials = card.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
    <defs>
      <radialGradient id="g" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#0b0b14"/>
      </radialGradient>
      <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="20" height="40" fill="#ffffff" opacity="0.04"/>
      </pattern>
    </defs>
    <rect width="640" height="640" fill="url(#g)"/>
    <rect width="640" height="640" fill="url(#p)"/>
    <circle cx="320" cy="290" r="170" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="6"/>
    <text x="320" y="335" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="700"
      fill="#ffffff" text-anchor="middle">${initials}</text>
    <text x="320" y="560" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#ffffff"
      fill-opacity="0.7" text-anchor="middle" letter-spacing="6">SEED · ${card.category.toUpperCase()}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];
const TIMES: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

async function seed() {
  await removeSeed();
  const campusId = env.DEFAULT_CAMPUS_ID;
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // How many seed copies of each card exist → drives realistic rarity.
  const totalCopies = CARDS.map((_, i) =>
    STUDENTS.reduce((n, s) => n + (s.owns.find((o) => o[0] === i)?.[1] ?? 0), 0),
  );

  const users = await User.insertMany(
    STUDENTS.map((s) => ({
      username: s.username,
      displayName: s.displayName,
      passwordHash,
      campusId,
      xp: s.xp,
      level: XPService.levelFor(s.xp).level,
      stats: { discoveries: s.owns.reduce((n, o) => n + o[1], 0), trades: 0 },
      isSeed: true,
    })),
  );

  const cards: (CardDoc | null)[] = [];
  for (const [i, c] of CARDS.entries()) {
    const canonicalKey = toCanonicalKey(c.name);
    // Don't overwrite a card a real player already discovered with the same identity.
    if (await Card.exists({ campusId, canonicalKey, isSeed: { $ne: true } })) {
      console.log(`[seed] skipping "${c.name}" (already discovered by a real player)`);
      cards.push(null);
      continue;
    }
    const { rarity, rarityScore } = RarityService.score({
      commonness: c.commonness,
      category: c.category,
      priorDiscoveries: totalCopies[i],
      confidence: 0.95,
      isLandmark: !!c.isLandmark,
    });
    const art = await storageService.put(
      `seed/${canonicalKey}.jpg`,
      await cardArt(c, RARITY_DISPLAY[rarity].color),
      'image/jpeg',
    );
    const owners = STUDENTS.map((s, si) => (s.owns.some((o) => o[0] === i) ? users[si] : null)).filter(Boolean);
    cards.push(
      await Card.create({
        campusId,
        canonicalKey,
        name: c.name,
        category: c.category,
        description: c.description,
        funFact: c.funFact,
        tags: c.tags,
        imageUrl: art.url,
        rarity,
        rarityScore,
        commonness: c.commonness,
        flags: { isLandmark: !!c.isLandmark },
        stats: { discoveryCount: totalCopies[i], uniqueDiscoverers: owners.length },
        firstDiscoveredBy: owners[0]?._id ?? null,
        isSeed: true,
      }),
    );
  }

  let copies = 0;
  for (const [si, s] of STUDENTS.entries()) {
    const user = users[si];
    for (const [cardIdx, count, tradable, favorite] of s.owns) {
      const card = cards[cardIdx];
      if (!card) continue;
      for (let k = 0; k < count; k++) {
        const discoveryId = new Types.ObjectId();
        const copyId = new Types.ObjectId();
        const when = new Date(Date.now() - (si * 7 + cardIdx * 3 + k) * 36e5 * 5);
        const environment = { season: SEASONS[(cardIdx + k) % 4], timeOfDay: TIMES[(si + k) % 4] };
        await OwnedCard.create({
          _id: copyId,
          ownerId: user._id,
          cardId: card._id,
          discoveryId,
          imageUrl: card.imageUrl,
          acquiredVia: 'discovery',
          xpAwarded: 25,
          tradable: k < tradable,
          favorite: !!favorite && k === 0,
          environment,
          acquiredAt: when,
          isSeed: true,
        });
        await Discovery.create({
          _id: discoveryId,
          userId: user._id,
          cardId: card._id,
          copyId,
          clientCaptureId: `seed-${discoveryId}`,
          photoUrl: card.imageUrl,
          cardImageUrl: card.imageUrl,
          aiAnalysis: { provider: 'seed', model: 'seed', name: card.name, category: card.category, confidence: 0.95 },
          environment: { campusId, ...environment, capturedAt: when },
          xpAwarded: 25,
          isDuplicate: k > 0,
          createdAt: when,
        });
        copies++;
      }
    }
    await User.updateOne(
      { _id: user._id },
      { $set: { wishlist: s.wishlist.map((i) => cards[i]?._id).filter(Boolean) } },
    );
  }

  console.log(`[seed] created ${users.length} students, ${cards.filter(Boolean).length} cards, ${copies} copies`);
  console.log(`[seed] log in as any of: ${STUDENTS.map((s) => s.username).join(', ')}  (password: ${SEED_PASSWORD})`);
}

await connectDatabase();
try {
  if (process.argv.includes('--reset')) await removeSeed();
  else await seed();
} finally {
  await disconnectDatabase();
}
