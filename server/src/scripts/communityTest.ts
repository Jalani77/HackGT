/**
 * Phase 4–5 checks: missions, group events, routes, rewards, achievements, level-up unlocks.
 * Needs a fresh seed and the MOCK AI (it photographs synthetic colored images):
 *   npm run seed && npx tsx src/scripts/communityTest.ts [baseUrl]
 * Creates an `api_*` user; remove it with `npm run cleanup:test-users -w server`.
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:4000';
let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as any };
}

/** Noisy solid-color photo. The mock AI names it by dominant color, so each color is a distinct card. */
async function photo([r, g, b]: [number, number, number]) {
  const w = 320, h = 240;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const n = Math.random() * 30 - 15;
    raw[i * 3] = Math.max(0, Math.min(255, r + n));
    raw[i * 3 + 1] = Math.max(0, Math.min(255, g + n));
    raw[i * 3 + 2] = Math.max(0, Math.min(255, b + n));
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

async function discover(token: string, rgb: [number, number, number], captureId = randomUUID()) {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(await photo(rgb))], { type: 'image/jpeg' }), 'capture.jpg');
  form.append('clientCaptureId', captureId);
  const res = await fetch(`${base}/api/discoveries/analyze`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: (await res.json()) as any };
}

const RED: [number, number, number] = [200, 30, 30];
const GREEN: [number, number, number] = [30, 190, 60];
const BLUE: [number, number, number] = [40, 80, 210];
const VIOLET: [number, number, number] = [150, 40, 210];
const TEAL: [number, number, number] = [30, 170, 170];

const login = async (u: string) => (await call('POST', '/auth/login', undefined, { username: u, password: 'password123' })).body;
const [maya, priya, sam] = await Promise.all(['maya', 'priya', 'sam'].map(login));
const me = (await call('POST', '/auth/register', undefined, { username: `api_c${Date.now() % 1e7}`, password: 'password123' })).body;
const T = me.token;
const levelUps: any[] = [];
const noteLevel = (r: any) => r?.levelUp && levelUps.push(r.levelUp);

// ─── Missions ────────────────────────────────────────────
let missions = (await call('GET', '/missions', T)).body;
const m = (key: string) => missions.find((x: any) => x.title === key);
check('missions are listed from the DB', missions.length >= 8, missions.length);
check('level-gated mission is locked', m('Landmark Hunter')?.status === 'locked', m('Landmark Hunter'));
check('joining a locked mission → 403', (await call('POST', `/missions/${m('Landmark Hunter').id}/join`, T)).status === 403);
for (const t of ['First Discovery', 'Something New', 'Show Up', 'Trade Partner']) {
  const r = await call('POST', `/missions/${m(t).id}/join`, T);
  check(`join "${t}"`, r.status === 200 && r.body.status === 'active', r.body);
}
check('client cannot set progress (unknown route)', (await call('PATCH', `/missions/${m('First Discovery').id}`, T, { progress: 99 })).status === 404);

const d1 = await discover(T, RED);
noteLevel(d1.body);
check('discovery → 201', d1.status === 201, d1.body);
const p1 = d1.body.progress;
check('First Discovery completes', p1?.missions.some((x: any) => x.title === 'First Discovery' && x.completed), p1?.missions);
check('Something New advances to 1/5', p1?.missions.some((x: any) => x.title === 'Something New' && x.progress === 1 && x.target === 5));
check('mission reward paid out', p1?.rewards.some((g: any) => g.source === 'mission' && g.xp === 50), p1?.rewards);
check('"First Steps" achievement unlocked', p1?.achievements.some((a: any) => a.key === 'first-steps'), p1?.achievements);
check('HUD objective reflects missions', d1.body.player.objective?.kind === 'mission', d1.body.player.objective);

const dup = await discover(T, RED);
check('duplicate does not advance "new cards only" mission', !dup.body.progress?.missions.some((x: any) => x.title === 'Something New'), dup.body.progress);
const replayId = randomUUID();
await discover(T, TEAL, replayId);
const replay = await discover(T, TEAL, replayId);
check('idempotent retry reports no new progress', replay.body.progress?.missions.length === 0 && replay.body.progress.xp === 0, replay.body.progress);
missions = (await call('GET', '/missions', T)).body;
check('Something New is 2/5 after new + dup + retry', m('Something New').progress === 2, m('Something New'));

// ─── Group events ────────────────────────────────────────
const events = (await call('GET', '/events', T)).body;
const walk = events.find((e: any) => e.title === 'Campus Discovery Walk');
check('live event listed', walk?.status === 'live', walk);
check('group not yet unlocked (2 of 3 checked in)', walk?.checkedIn === 2 && walk.groupUnlocked === false, walk);
check('non-host does not see check-in code', walk?.checkInCode === null);
const hostView = (await call('GET', `/events/${walk.id}`, maya.token)).body;
check('host sees check-in code', typeof hostView.checkInCode === 'string' && hostView.checkInCode.length === 5, hostView);
check('wrong code → 400', (await call('POST', `/events/${walk.id}/checkin`, T, { code: 'ZZZZZ' })).status === 400);
const ci = await call('POST', `/events/${walk.id}/checkin`, T, { code: hostView.checkInCode.toLowerCase() });
check('check in with code (case-insensitive)', ci.status === 200 && ci.body.data.me.checkedIn, ci.body);
check('3rd check-in unlocks the group', ci.body.data?.groupUnlocked === true && ci.body.data.checkedIn === 3);
check('no reward yet: 1 discovery required after check-in', ci.body.progress?.rewards.length === 0, ci.body.progress);
check('HUD objective switches to the live event', ci.body.player.objective?.kind === 'event', ci.body.player.objective);

const d2 = await discover(T, GREEN);
noteLevel(d2.body);
const eventGrant = d2.body.progress?.rewards.find((g: any) => g.source === 'event');
check('discovery at event pays the group card', eventGrant?.card?.name === 'Campus Explorer', d2.body.progress?.rewards);
check('group card is a special event card', eventGrant?.card?.source === 'event' && eventGrant.card.rarity === 'EPIC', eventGrant?.card);
check('"Show Up" mission completes from attending', d2.body.progress?.missions.some((x: any) => x.title === 'Show Up' && x.completed));
check('"Community Member" achievement', d2.body.progress?.achievements.some((a: any) => a.key === 'community-member'));
const walkAfter = (await call('GET', `/events/${walk.id}`, T)).body;
check('event shows me as rewarded', walkAfter.me.rewarded === true, walkAfter.me);
const d3 = await discover(T, BLUE);
check('event reward is paid only once', !d3.body.progress?.rewards.some((g: any) => g.source === 'event'), d3.body.progress?.rewards);
noteLevel(d3.body);

// ─── Routes ──────────────────────────────────────────────
const cards = (await call('GET', '/cards?limit=200', priya.token)).body;
const cardial = cards.find((c: any) => c.name === 'Northern Cardinal');
const magnolia = cards.find((c: any) => c.name === 'Southern Magnolia');
const bad = await call('POST', '/routes', priya.token, {
  title: 'Cardinal Chase',
  checkpoints: [{ label: 'Cardinal', cardId: cardial.id }, { label: 'Anything' }],
});
check("route can't use a card the creator never discovered → 400", bad.status === 400, bad.body);
const created = await call('POST', '/routes', priya.token, {
  title: `Test Loop ${Date.now() % 1e5}`,
  description: 'Two quick finds.',
  checkpoints: [{ label: 'Anything first', area: 'Tech Green' }, { label: 'Anything else' }],
  estMinutes: 5,
});
check('create route → 201', created.status === 201 && created.body.data.checkpoints.length === 2, created.body);
check('route with a card the creator found is allowed', (await call('POST', '/routes', priya.token, {
  title: `Magnolia Hop ${Date.now() % 1e5}`,
  checkpoints: [{ label: 'Magnolia', cardId: magnolia.id }, { label: 'Any plant', category: 'Plant' }],
})).status === 201);
const routeId = created.body.data.id;
check('fresh player cannot publish routes (level gate)', (await call('POST', '/routes', (await call('POST', '/auth/register', undefined, { username: `api_r${Date.now() % 1e7}`, password: 'password123' })).body.token, { title: 'Nope', checkpoints: [{ label: 'a' }, { label: 'b' }] })).status === 403);

const trail = (await call('GET', '/missions', T)).body.find((x: any) => x.title === 'Trail Runner');
check('Trail Runner join (level ≥ 2 now)', (await call('POST', `/missions/${trail.id}/join`, T)).status === 200, trail);
check('start route', (await call('POST', `/routes/${routeId}/start`, T)).body.myRun?.status === 'active');
check('starting twice → 409', (await call('POST', `/routes/${routeId}/start`, T)).status === 409);
const r1 = await discover(T, BLUE); // already own Blue → still a find, and a new card for this run
check('checkpoint 1 hit', r1.body.progress?.routes.some((x: any) => x.routeId === routeId && x.done === 1), r1.body.progress?.routes);
const r1b = await discover(T, BLUE);
check('same card cannot satisfy the next generic checkpoint', !r1b.body.progress?.routes.some((x: any) => x.routeId === routeId), r1b.body.progress?.routes);
const r2 = await discover(T, VIOLET);
noteLevel(r2.body);
check('route completes', r2.body.progress?.routes.some((x: any) => x.routeId === routeId && x.completed), r2.body.progress?.routes);
check('route reward paid', r2.body.progress?.rewards.some((g: any) => g.source === 'route' && g.xp === 150), r2.body.progress?.rewards);
check('Trail Runner completes via follow-up activity', r2.body.progress?.missions.some((x: any) => x.title === 'Trail Runner' && x.completed));
const routeAfter = (await call('GET', `/routes/${routeId}`, T)).body;
check('route marked completed by me', routeAfter.completedByMe && routeAfter.stats.completions === 1, routeAfter);
await call('POST', `/routes/${routeId}/start`, T);
await discover(T, RED);
const again = await discover(T, GREEN);
check('re-running a route pays nothing the second time', again.body.progress?.routes.some((x: any) => x.completed) && !again.body.progress.rewards.some((g: any) => g.source === 'route'), again.body.progress);

// ─── Rewards ─────────────────────────────────────────────
const rewards = (await call('GET', '/rewards', T)).body;
const sticker = rewards.find((r: any) => r.minLevel === 2);
const medal = rewards.find((r: any) => r.type === 'collectible');
check('level-2 reward unlocked', sticker?.unlocked === true, sticker);
check('level-15 reward locked → 403 on redeem', (await call('POST', `/rewards/${medal.id}/redeem`, T)).status === 403);
const red = await call('POST', `/rewards/${sticker.id}/redeem`, T);
check('redeem → code', /^CQ-\w{4}-\w{4}$/.test(red.body.data?.reward.redemption?.code ?? ''), red.body);
const red2 = await call('POST', `/rewards/${sticker.id}/redeem`, T);
check('redeem is idempotent (same code)', red2.body.data?.reward.redemption?.code === red.body.data.reward.redemption.code);
check('level-up lists unlocked perks', levelUps.some((l) => l.unlocks.some((u: string) => u.includes('sticker'))), levelUps);

// ─── Trades count for missions (both sides) ──────────────
const col = (await call('GET', '/users/me/collection', T)).body.entries;
const copy = col.find((e: any) => e.card.source === 'discovery').copies[0];
await call('PATCH', `/collection/${copy.id}`, T, { tradable: true });
const gift = await call('POST', '/trades', T, { toUserId: sam.user.id, offeredCopyIds: [copy.id], requestedCopyIds: [] });
const acc = await call('POST', `/trades/${gift.body.id}/accept`, sam.token);
check('trade accepted with progress payload', acc.status === 200 && Array.isArray(acc.body.progress?.achievements), acc.body);
missions = (await call('GET', '/missions', T)).body;
check("proposer's Trade Partner mission completes too", m('Trade Partner').status === 'completed', m('Trade Partner'));

// ─── Hosting events ──────────────────────────────────────
const start = new Date(Date.now() + 2 * 36e5).toISOString();
const hosted = await call('POST', '/events', T, {
  title: 'Lunch & Look Around',
  kind: 'social',
  locationName: 'Student Center patio',
  startsAt: start,
  durationMinutes: 60,
  minParticipants: 2,
});
check('student hosts an event', hosted.status === 201 && hosted.body.me.isHost && !!hosted.body.checkInCode, hosted.body);
check('hosted events award XP, never cards', hosted.body.reward.card === null && hosted.body.reward.xp > 0);
check('RSVP', (await call('POST', `/events/${hosted.body.id}/join`, sam.token)).body.going === 2);
check('early check-in rejected', (await call('POST', `/events/${hosted.body.id}/checkin`, sam.token, { code: hosted.body.checkInCode })).status === 409);

// ─── Profile ─────────────────────────────────────────────
const prof = (await call('GET', '/users/me/profile', T)).body;
check('profile lists achievements', prof.achievements?.length >= 10 && prof.achievements.some((a: any) => a.unlockedAt));
check('profile stats count missions/events/routes', prof.user.stats.missionsCompleted >= 3 && prof.user.stats.eventsAttended === 1 && prof.user.stats.routesCompleted === 1, prof.user.stats);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll community checks passed ✔');
process.exit(failures ? 1 : 0);
