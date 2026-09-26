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
- ✅ **Phase 2: Collection.** Profiles (rarest card, favorites, explorer style, recent finds), favorite and tradable flags per copy, collection filters, 15 levels, seed data
- ⏳ Phase 3: Wishlist and trading
- ⏳ Phase 4: Missions, group events, rewards, achievements
- ⏳ Phase 5: Routes
