/**
 * Wishlist + trading checks. Mutates seed data, so run a fresh seed first:
 *   npm run seed && npx tsx src/scripts/tradeTest.ts [baseUrl]
 */
export {};

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
const login = async (u: string) => (await call('POST', '/auth/login', undefined, { username: u, password: 'password123' })).body;
const [jordan, maya, alex, sam] = await Promise.all(['jordan', 'maya', 'alex', 'sam'].map(login));
const collection = async (t: string) => (await call('GET', '/users/me/collection', t)).body.entries as any[];
const findCopy = (entries: any[], name: string, tradable: boolean) =>
  entries.find((e) => e.card.name === name)?.copies.find((c: any) => c.tradable === tradable);
const cardId = async (name: string) => (await call('GET', `/cards?q=${encodeURIComponent(name)}`, jordan.token)).body[0].id;

// ─── Wishlist ────────────────────────────────────────────
const kessler = await cardId('Kessler Campanile');
check('add to wishlist', (await call('POST', '/wishlist', jordan.token, { cardId: kessler })).status === 201);
check('adding twice is idempotent', (await call('POST', '/wishlist', jordan.token, { cardId: kessler })).status === 201);
let social = (await call('GET', `/cards/${kessler}/social`, jordan.token)).body;
check('card social: inMyWishlist', social.inMyWishlist === true, social);
check('card social: lists who can trade it (maya/priya have it, not tradable → none)', Array.isArray(social.tradableBy));
const wl = (await call('GET', '/users/me/wishlist', jordan.token)).body;
check('wishlist lists the card', wl.some((w: any) => w.card.id === kessler), wl.map((w: any) => w.card.name));
const theirs = (await call('GET', `/users/${jordan.user.id}/wishlist`, maya.token)).body;
check("others can see my wishlist", theirs.length === wl.length);
check('remove from wishlist', (await call('DELETE', `/wishlist/${kessler}`, jordan.token)).status === 200);
social = (await call('GET', `/cards/${kessler}/social`, jordan.token)).body;
check('card social: no longer in wishlist', social.inMyWishlist === false);
check('wishlist rejects unknown card', (await call('POST', '/wishlist', jordan.token, { cardId: '0123456789abcdef01234567' })).status === 404);

// ─── Student directory / matches ─────────────────────────
const students = (await call('GET', '/students', jordan.token)).body;
const mayaRow = students.find((s: any) => s.username === 'maya');
check('directory excludes me', !students.some((s: any) => s.username === 'jordan'));
check('directory: maya has Southern Magnolia I want', mayaRow?.iWantFromThem.some((c: any) => c.name === 'Southern Magnolia'), mayaRow);
check('directory ranks matches first', students[0].iWantFromThem.length + students[0].theyWantFromMe.length > 0, students[0]);

// ─── Trade validation ────────────────────────────────────
let jc = await collection(jordan.token);
let mc = await collection(maya.token);
const myMyrtle = findCopy(jc, 'Crape Myrtle', true);
const myLockedTower = findCopy(jc, 'Tech Tower', false);
const herMagnolia = findCopy(mc, 'Southern Magnolia', true);
const herLockedMagnolia = findCopy(mc, 'Southern Magnolia', false);

const offer = (body: any, t = jordan.token) => call('POST', '/trades', t, { toUserId: maya.user.id, ...body });
check('offer a non-tradable copy → 409', (await offer({ offeredCopyIds: [myLockedTower.id], requestedCopyIds: [herMagnolia.id] })).status === 409);
check("offer someone else's copy → 409", (await offer({ offeredCopyIds: [herMagnolia.id], requestedCopyIds: [] })).status === 409);
check('request a non-tradable copy → 409', (await offer({ offeredCopyIds: [myMyrtle.id], requestedCopyIds: [herLockedMagnolia.id] })).status === 409);
check('trade with yourself → 400', (await call('POST', '/trades', jordan.token, { toUserId: jordan.user.id, offeredCopyIds: [myMyrtle.id], requestedCopyIds: [] })).status === 400);
check('empty offer → 400', (await offer({ offeredCopyIds: [], requestedCopyIds: [herMagnolia.id] })).status === 400);
check('duplicate copies → 400', (await offer({ offeredCopyIds: [myMyrtle.id, myMyrtle.id], requestedCopyIds: [] })).status === 400);
check('extra fields rejected → 400', (await offer({ offeredCopyIds: [myMyrtle.id], requestedCopyIds: [], status: 'accepted' })).status === 400);

// ─── Happy path ──────────────────────────────────────────
const created = await offer({ offeredCopyIds: [myMyrtle.id], requestedCopyIds: [herMagnolia.id], message: 'Swap for your magnolia?' });
check('valid offer → 201 pending', created.status === 201 && created.body.status === 'pending', created.body);
const tradeId = created.body.id;
const mayaMe = (await call('GET', '/auth/me', maya.token)).body;
check('maya is notified of incoming offer', mayaMe.notifications.incomingTrades >= 1, mayaMe.notifications);
const mayaTrades = (await call('GET', '/trades?status=pending', maya.token)).body;
check('maya sees it as incoming', mayaTrades.some((t: any) => t.id === tradeId && t.direction === 'incoming'));
check("proposer can't accept own offer → 404", (await call('POST', `/trades/${tradeId}/accept`, jordan.token)).status === 404);
check("third party can't accept → 404", (await call('POST', `/trades/${tradeId}/accept`, alex.token)).status === 404);

const jordanXpBefore = (await call('GET', '/auth/me', jordan.token)).body.level.xp;
// Two simultaneous accepts: exactly one may succeed.
const [a1, a2] = await Promise.all([
  call('POST', `/trades/${tradeId}/accept`, maya.token),
  call('POST', `/trades/${tradeId}/accept`, maya.token),
]);
check('concurrent accepts: exactly one succeeds', [a1.status, a2.status].sort().join() === '200,409', [a1.status, a2.status]);
const accepted = a1.status === 200 ? a1.body : a2.body;
check('accepted trade awards XP', accepted.xpAwarded === 25, accepted);

jc = await collection(jordan.token);
mc = await collection(maya.token);
check('jordan now owns the magnolia copy', jc.some((e) => e.copies.some((c: any) => c.id === herMagnolia.id)));
check('maya now owns the crape myrtle copy', mc.some((e) => e.copies.some((c: any) => c.id === myMyrtle.id)));
const received = mc.flatMap((e) => e.copies).find((c: any) => c.id === myMyrtle.id);
check('received copy is marked acquiredVia=trade and not tradable', received.acquiredVia === 'trade' && received.tradable === false, received);
const jordanWl = (await call('GET', '/users/me/wishlist', jordan.token)).body;
check('received card removed from wishlist', !jordanWl.some((w: any) => w.card.name === 'Southern Magnolia'), jordanWl.map((w: any) => w.card.name));
const jordanAfter = (await call('GET', '/auth/me', jordan.token)).body;
check('proposer also got trade XP + trade count', jordanAfter.level.xp === jordanXpBefore + 25 && jordanAfter.stats.trades === 1, jordanAfter);
check('accepting again → 409', (await call('POST', `/trades/${tradeId}/accept`, maya.token)).status === 409);

// ─── Stale offers ────────────────────────────────────────
jc = await collection(jordan.token);
const bikeRack = findCopy(jc, 'Bike Rack', true);
const toAlex = await call('POST', '/trades', jordan.token, { toUserId: alex.user.id, offeredCopyIds: [bikeRack.id], requestedCopyIds: [] });
const toSam = await call('POST', '/trades', jordan.token, { toUserId: sam.user.id, offeredCopyIds: [bikeRack.id], requestedCopyIds: [] });
check('same copy can be offered to two people', toAlex.status === 201 && toSam.status === 201, [toAlex.body, toSam.body]);
check('alex accepts (a gift)', (await call('POST', `/trades/${toAlex.body.id}/accept`, alex.token)).status === 200);
const samView = (await call('GET', '/trades', sam.token)).body.find((t: any) => t.id === toSam.body.id);
check("sam's copy of the offer auto-expires", samView?.status === 'expired', samView);
check('sam accepting the stale offer → 409', (await call('POST', `/trades/${toSam.body.id}/accept`, sam.token)).status === 409);

// Card un-marked tradable after the offer → accept fails cleanly, nothing moves.
jc = await collection(jordan.token);
const bee = findCopy(jc, 'Northern Cardinal', true);
const beeOffer = await call('POST', '/trades', jordan.token, { toUserId: sam.user.id, offeredCopyIds: [bee.id], requestedCopyIds: [] });
await call('PATCH', `/collection/${bee.id}`, jordan.token, { tradable: false });
const staleAccept = await call('POST', `/trades/${beeOffer.body.id}/accept`, sam.token);
check('accept after card un-marked tradable → 409', staleAccept.status === 409, staleAccept.body);
jc = await collection(jordan.token);
check('…and the copy stayed with jordan', jc.some((e) => e.copies.some((c: any) => c.id === bee.id)));

// ─── Decline / cancel ────────────────────────────────────
await call('PATCH', `/collection/${bee.id}`, jordan.token, { tradable: true });
const d = await call('POST', '/trades', jordan.token, { toUserId: sam.user.id, offeredCopyIds: [bee.id], requestedCopyIds: [] });
check('decline', (await call('POST', `/trades/${d.body.id}/reject`, sam.token)).body.status === 'declined');
const c = await call('POST', '/trades', jordan.token, { toUserId: sam.user.id, offeredCopyIds: [bee.id], requestedCopyIds: [] });
check("recipient can't cancel → 404", (await call('POST', `/trades/${c.body.id}/cancel`, sam.token)).status === 404);
check('proposer cancels', (await call('POST', `/trades/${c.body.id}/cancel`, jordan.token)).body.status === 'cancelled');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
