/**
 * API checks that don't depend on the AI provider (auth, profiles, collection flags, ownership).
 * Requires seed data:  npm run seed  →  npx tsx src/scripts/apiTest.ts [baseUrl]
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

const login = async (username: string) => (await call('POST', '/auth/login', undefined, { username, password: 'password123' })).body;

const jordan = await login('jordan');
const maya = await login('maya');
check('seed users can log in (username case-insensitive path)', !!jordan.token && !!maya.token, { jordan, maya });
const upper = await call('POST', '/auth/login', undefined, { username: 'JORDAN', password: 'password123' });
check('login is case-insensitive on username', upper.status === 200);
const wrong = await call('POST', '/auth/login', undefined, { username: 'jordan', password: 'nope123' });
check('wrong password → 401', wrong.status === 401);

const fresh = `api_${Date.now().toString(36)}`;
const reg = await call('POST', '/auth/register', undefined, { username: fresh, password: 'secret123' });
check('register new user → 201', reg.status === 201, reg.body);
const dupReg = await call('POST', '/auth/register', undefined, { username: fresh.toUpperCase(), password: 'secret123' });
check('duplicate username (any case) → 409', dupReg.status === 409, dupReg.body);
const badReg = await call('POST', '/auth/register', undefined, { username: 'a b', password: '1' });
check('invalid registration → 400 with message', badReg.status === 400 && !!badReg.body.error?.message, badReg.body);

const profile = await call('GET', '/users/me/profile', jordan.token);
check('own profile', profile.status === 200 && profile.body.isMe === true, profile.body);
check('profile has rarest card', !!profile.body.rarestCard?.card?.name);
check('profile has favorites', profile.body.favorites?.length >= 1);
check('profile tradableCount matches seed (1+2+1 = 4)', profile.body.tradableCount === 4, profile.body.tradableCount);
check('profile has recent discoveries', profile.body.recentDiscoveries?.length > 0);
check('profile never exposes passwordHash', !JSON.stringify(profile.body).includes('passwordHash'));

const other = await call('GET', `/users/${maya.user.id}/profile`, jordan.token);
check("viewing another student's profile", other.status === 200 && other.body.isMe === false);

const col = await call('GET', '/users/me/collection', jordan.token);
const copy = col.body.entries[0].copies[0];
const flip = await call('PATCH', `/collection/${copy.id}`, jordan.token, { favorite: !copy.favorite });
check('toggle favorite on own copy', flip.status === 200 && flip.body.favorite === !copy.favorite, flip.body);
const trade = await call('PATCH', `/collection/${copy.id}`, jordan.token, { tradable: !copy.tradable });
check('toggle tradable on own copy', trade.status === 200 && trade.body.tradable === !copy.tradable, trade.body);
await call('PATCH', `/collection/${copy.id}`, jordan.token, { favorite: copy.favorite, tradable: copy.tradable });

const steal = await call('PATCH', `/collection/${copy.id}`, maya.token, { tradable: true });
check("can't modify another student's copy → 404", steal.status === 404, steal.body);
const hack = await call('PATCH', `/collection/${copy.id}`, jordan.token, { ownerId: maya.user.id, xpAwarded: 9999 });
check('non-editable fields rejected → 400', hack.status === 400, hack.body);
const empty = await call('PATCH', `/collection/${copy.id}`, jordan.token, {});
check('empty patch rejected → 400', empty.status === 400);
const bogus = await call('PATCH', '/collection/not-an-id', jordan.token, { favorite: true });
check('bad copy id → 404', bogus.status === 404);

const cards = await call('GET', '/cards', jordan.token);
check('catalog lists seeded cards', cards.body.length >= 10, cards.body.length);
const wanted = cards.body.find((c: any) => c.name === 'Tech Tower');
check('"wanted by" counts come from wishlists (Tech Tower: maya, alex, sam = 3)', wanted?.stats.wantedBy === 3, wanted?.stats);
check('no player-facing POST /cards', (await call('POST', '/cards', jordan.token, { name: 'Free Legendary' })).status === 404);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
