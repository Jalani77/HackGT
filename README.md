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
| `npm run smoke` | end-to-end API test against the running server (register → analyze → duplicate → idempotent retry → invalid images → collection) |
| `npm run build` | production client build |

## Status

- ✅ **Phase 1: Core discovery.** Camera → upload → AI → card → rarity → XP → MongoDB → reveal → collection
- ⏳ Phase 2: Collection polish (profile, favorites, tradable flag)
- ⏳ Phase 3: Wishlist and trading
- ⏳ Phase 4: Missions, group events, rewards, achievements
- ⏳ Phase 5: Routes
