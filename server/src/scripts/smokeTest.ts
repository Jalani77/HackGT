/**
 * End-to-end smoke test for the Phase 1 pipeline against a running server.
 *   npx tsx src/scripts/smokeTest.ts [baseUrl]
 * Generates real JPEGs (no fixtures) and exercises the full discovery flow.
 */
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:4000';
let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};

async function photo(r: number, g: number, b: number) {
  // Gradient + noise so it's a plausible photo, not a flat square.
  const w = 400, h = 300;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const n = Math.random() * 40 - 20;
    raw[i * 3] = Math.max(0, Math.min(255, r + n));
    raw[i * 3 + 1] = Math.max(0, Math.min(255, g + n));
    raw[i * 3 + 2] = Math.max(0, Math.min(255, b + n));
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

async function analyze(token: string, img: Buffer, captureId = randomUUID(), type = 'image/jpeg') {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(img)], { type }), 'capture.jpg');
  form.append('clientCaptureId', captureId);
  const res = await fetch(`${base}/api/discoveries/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

const username = `smoke_${Date.now().toString(36)}`;
const reg = await fetch(`${base}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password: 'secret123' }),
});
const auth = (await reg.json()) as any;
check('register → 201 + token', reg.status === 201 && !!auth.token, auth);
const token = auth.token as string;

const unauth = await fetch(`${base}/api/users/me/collection`);
check('collection without token → 401', unauth.status === 401);

const green = await photo(40, 160, 60);
const first = await analyze(token, green);
check('analyze → 201', first.status === 201, first.body);
check('card has name/fact/rarity', !!first.body.card?.name && !!first.body.card?.funFact && !!first.body.card?.rarity);
check('xp awarded > 0', first.body.xp?.awarded > 0, first.body.xp);
check('not a duplicate', first.body.isDuplicate === false);
// Total XP = the discovery itself + anything it unlocked (missions, achievements like "First Steps").
const totalXp = (r: any) => r.body.xp.awarded + (r.body.progress?.xp ?? 0);
check('player xp updated', first.body.player?.level?.xp === totalXp(first), first.body.player);
console.log(`      → ${first.body.card?.name} [${first.body.card?.rarity} ${first.body.card?.rarityScore}] +${first.body.xp?.awarded}xp via ${first.body.aiProvider}`);

const imgRes = await fetch(`${base}${first.body.card?.imageUrl}`);
check('card image served', imgRes.ok && imgRes.headers.get('content-type') === 'image/jpeg');

const dup = await analyze(token, await photo(45, 165, 55));
check('same subject again → duplicate copy', dup.status === 201 && dup.body.isDuplicate === true, dup.body);
check('duplicate refers to same card', dup.body.card?.id === first.body.card?.id);
check('duplicate pays reduced xp', dup.body.xp?.awarded < first.body.xp?.awarded, dup.body.xp);

const retryId = randomUUID();
const a = await analyze(token, await photo(200, 40, 40), retryId);
const b = await analyze(token, await photo(200, 40, 40), retryId);
check('retry with same captureId is idempotent', a.body.discoveryId === b.body.discoveryId && a.status === 201 && b.status === 201, [a.body, b.body]);

const bad = await analyze(token, Buffer.from('definitely not an image'));
check('garbage upload → INVALID_IMAGE', bad.status === 400 && bad.body.error?.code === 'INVALID_IMAGE', bad.body);

const tiny = await analyze(token, await sharp({ create: { width: 20, height: 20, channels: 3, background: '#0f0' } }).jpeg().toBuffer());
check('tiny image → INVALID_IMAGE', tiny.body.error?.code === 'INVALID_IMAGE', tiny.body);

const col = (await (await fetch(`${base}/api/users/me/collection`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
check('collection: 2 unique cards, 3 copies', col.totals?.uniqueOwned === 2 && col.totals?.copies === 3, col.totals);
check('collection groups duplicate copies', col.entries?.some((e: any) => e.copies.length === 2));

const me = (await (await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
const expectedXp = totalXp(first) + totalXp(dup) + totalXp(a);
check('persisted xp matches awards (retry not double-counted)', me.level?.xp === expectedXp, { got: me.level?.xp, expectedXp });
check('persisted discoveries = 3', me.stats?.discoveries === 3, me.stats);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
