# Campus Quest 🧭

**Go outside. Discover something. Learn something. Collect something. Meet someone.**

Point your phone at anything on campus. AI identifies it and teaches you a fun fact, and
it becomes a collectible card. Trading, missions, and group events (coming in later phases)
turn collecting into a reason to meet other students.

Built for the HackGT Social Good track. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Quick start

```bash
npm install
cp .env.example .env          # then set AI_API_KEY (OpenAI) for real identification
npm run dev                   # API on :4000, app on http://localhost:5173
```

* **No MongoDB setup needed in dev.** If `MONGODB_URI` is empty, a real `mongod` starts
  automatically with data persisted in `server/.data/mongo`. The first run downloads the binary (~800 MB, one time).
  Set `MONGODB_URI` to an Atlas connection string to use Atlas instead.
* **Caches** (the MongoDB dev binary and seed stock photos) go in `CACHE_DIR`. If it's empty, they go in
  `server/.cache` inside the project, which git ignores. Point it at another drive to save space on your system
  disk. If that drive is missing, the server warns and falls back to the default.
* **No AI key?** The server falls back to `MockRecognitionService`, which derives an honest
  "Unidentified <color> Specimen" from the photo so the rest of the pipeline can be tested.
  The UI shows a "dev mode" note when it's active.
* **Testing on a phone:** browsers only allow camera access over HTTPS or on localhost. Set `VITE_HTTPS=1`
  in `.env`, then open `https://<your-LAN-IP>:5173` on the phone and accept the self-signed certificate.
  If the camera isn't available, the app offers photo upload through the same pipeline.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | server + client with hot reload |
| `npm run typecheck` | TypeScript checks for both packages |
| `npm run seed` | **test data**: 5 students (`jordan`, `maya`, `alex`, `priya`, `sam`, password `password123`) with cards, duplicates, and wishlists. Everything is flagged `isSeed`. `npm run seed -- --reset` removes it. |
| `npm run test:api -w server` | auth, profile, and collection-permission checks (needs seed data; works with any AI provider) |
| `npm run test:community -w server` | missions, group events, routes, rewards, achievements, level-up unlocks (**fresh seed + mock AI**: it photographs synthetic images) |
| `npm run test:trades -w server` | wishlist + trading checks: ownership, stale offers, concurrent accepts, XP (**run `npm run seed` first**; it changes seed data) |
| `npm run smoke` | discovery pipeline test (register → analyze → duplicate → idempotent retry → invalid images). Uses synthetic images, so run it with the **mock** AI (empty `AI_API_KEY`) |
| `npm run cleanup:test-users -w server` | delete accounts created by the test scripts (`smoke_*`, `ui_*`, `real_*`, `api_*`) |
| `npm run build` | production client build |

The seed data deliberately does **not** include the Southern Live Oak (the live-demo subject). That card is only ever created by photographing one.

### Using MongoDB Atlas
Put the connection string in `MONGODB_URI`. The database name comes from `MONGODB_DB` (default `campus-discovery`).
In Atlas → **Security → Network Access**, allow your IP. Campus and mobile IPs change often, so `0.0.0.0/0` is the
practical choice for a hackathon (use a strong DB password). A TLS "alert number 80" error at startup means the IP is blocked.

## Status

- ✅ **Phase 1: Core discovery.** Camera → upload → AI → card → rarity → XP → MongoDB → reveal → collection
- ✅ **Phase 2: Collection.** Profiles (rarest card, favorites, explorer style, recent finds), favorite and tradable flags per copy, collection filters, 15 levels, seed data with credited Wikimedia Commons stock photos
- ✅ **Phase 3: Social.**
  - Wishlists that other students can see.
  - A student directory ranked by trade matches ("Has 2 you want" / "Wants 1 of yours").
  - "Wanted by" and "can trade it to you" lists on every card.
  - A "Missing" filter for campus cards you haven't found.
  - Trade proposals (gifts allowed), with accept, decline, and cancel.
  - Incoming-offer badges.
  - Ownership is re-checked on accept, and copies move all-or-nothing (a transaction on Atlas, rollback locally).
- ✅ **Phase 4: Community** (**Quests** tab and Profile)
  - Missions stored in the database. They only count activity after you join, can't double-count, and pay rewards once.
  - Group events with RSVP and check-in codes shared in person. The group reward unlocks at the minimum
    number of check-ins, and each person also needs discoveries during the event.
  - Students at level 2+ can host their own events (XP only; special cards come from official events).
  - Student deals and exclusive collectibles unlocked by level.
  - 14 achievements.
  - Level-ups list exactly what they unlocked.
  - The camera HUD shows your current objective.
- ✅ **Phase 5: Exploration.** Strava-style routes (ordered checkpoints: a specific card, a category, or anything),
  a route builder for students at level 2+, first-completion rewards, and a creator bonus when others finish your route.

**Demo tip:** seeded events are scheduled relative to when you run the seed (for example, the Campus Discovery
Walk starts 20 minutes *before* seeding and lasts 4 hours). Run `npm run seed` shortly before a demo so the live
event is still live. Hosts see their check-in code on the event page.
