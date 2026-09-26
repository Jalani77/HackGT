# Campus Discovery — Architecture

> Go outside. Discover something. Learn something. Collect something. Meet someone.

## 1. Architecture diagram

```text
┌──────────────────────────── CLIENT (React PWA, mobile-first) ────────────────────────────┐
│  ExploreScreen ── CameraView (getUserMedia) ── capture → Blob (+ file-input fallback)    │
│        │                                                                                 │
│        │  multipart/form-data  POST /api/discoveries/analyze  (JWT, clientCaptureId)     │
│        ▼                                                                                 │
│  CardReveal (rarity-driven animation) → Collection / CardDetail / Social / Missions ...  │
└────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                         │ HTTPS (Vite proxy in dev → same origin)
┌────────────────────────────────────────▼──── SERVER (Express + TS) ──────────────────────┐
│ routes → middleware (auth, upload, rate-limit) → controllers (thin: parse/validate/HTTP) │
│                                                                                          │
│   DiscoveryService.analyze()  ← orchestrates the whole pipeline                          │
│      1. ImageService      validate, resize, re-encode (strips EXIF/GPS) → photo + card img │
│      2. AIRecognitionService.analyzeImage()  ← interface; OpenAI | Mock impl             │
│      3. validate ObjectAnalysis (zod) · reject people · confidence gates                 │
│      4. StorageService.put()  ← interface; LocalDisk now, S3/R2/Cloudinary later          │
│      5. CardService.findOrCreate()   (catalog entry per campus + canonical key)          │
│      6. RarityService.score()        (configurable rules, not random)                    │
│      7. CollectionService.addCopy()  (duplicates are real, tradable copies)              │
│      8. XPService.award()            (server-side XP + level)                            │
│                                                                                          │
│ Phase 2+: TradeService · WishlistService · MissionService · EventService · RewardService │
└──────────┬──────────────────────────────┬────────────────────────────┬───────────────────┘
           │                              │                            │
     ┌─────▼──────┐              ┌────────▼────────┐          ┌────────▼─────────┐
     │  MongoDB   │              │  Vision AI API  │          │  Image storage   │
     │ Atlas / in-│              │ (OpenAI, key    │          │ (URL/ref stored  │
     │ memory dev │              │  server-only)   │          │  in Mongo only)  │
     └────────────┘              └─────────────────┘          └──────────────────┘
```

Key rule: **the AI only describes the object.** Rarity, XP, value, duplicates,
mission progress, and ownership are all decided by server business logic.

## 2. Technology stack

| Layer    | Choice | Why |
|----------|--------|-----|
| Frontend | React 19 + TypeScript + Vite, Tailwind v4, `motion` for the reveal | Fast dev loop; mobile camera via `getUserMedia` |
| Backend  | Node 24 + Express 5 + TypeScript (run with `tsx`) | Express 5 forwards async errors natively |
| Database | MongoDB via Mongoose; Atlas in prod, `mongodb-memory-server` (persistent `dbPath`) in dev | Zero-setup local dev that keeps its state across restarts |
| AI       | `AIRecognitionService` interface → `OpenAIRecognitionService` (structured JSON output) | Swappable vendor |
| Images   | `sharp` (validate/resize/strip metadata) → `StorageService` interface → local disk | Swap to S3/R2 without touching the pipeline |
| Auth     | username + password (bcrypt) → JWT | Simple MVP auth, easy to replace with campus SSO |
| Validation | `zod` on AI output and request bodies | AI output is untrusted input |

## 3. Directory structure

```text
/
├─ package.json            npm workspaces + `npm run dev` (server + client together)
├─ .env.example
├─ shared/                 types + constants shared by client & server (no logic)
│  ├─ types.ts
│  └─ rarity.ts
├─ server/src/
│  ├─ index.ts / app.ts
│  ├─ config/              env, db, rarity.config, xp.config
│  ├─ models/              User, Card, Discovery, OwnedCard (+ Trade, Mission, Event, Route, Reward later)
│  ├─ services/
│  │  ├─ ai/               AIRecognitionService (interface), OpenAI + Mock impls, schema
│  │  ├─ storage/          StorageService (interface), LocalStorageService
│  │  └─ *.ts              Image, Card, Rarity, XP, Collection, Discovery, User, Auth
│  ├─ controllers/  routes/  middleware/  utils/
│  └─ scripts/seed.ts      clearly-labelled test seed data
└─ client/src/
   ├─ api/                 typed fetch client
   ├─ context/             PlayerContext (auth + progress)
   ├─ hooks/               useCamera
   ├─ components/          camera/, cards/, layout/
   └─ screens/             Login, Explore, Collection, CardDetail, Social, Missions, Events, Profile
```

## 4. MongoDB schema design

A **Card** is a catalog entry ("Southern Live Oak on Georgia Tech campus").
An **OwnedCard** is one physical copy a student holds. Duplicates are extra
copies, and trades move copies between owners. That makes ownership checks a
single indexed lookup.

| Collection | Key fields | Indexes |
|---|---|---|
| `users` | username, passwordHash, campusId, xp, level, stats{discoveries, trades}, wishlist[cardId], achievements[] | username unique |
| `cards` | campusId, canonicalKey, name, category, description, funFact, tags[], imageUrl, rarity, rarityScore, flags{isLandmark, isEvent, requiresGroup, requiresMission, seasonal[]}, stats{discoveryCount, uniqueDiscoverers}, firstDiscoveredBy, source(discovery/event/mission/route) | (campusId, canonicalKey) unique |
| `discoveries` | userId, cardId, clientCaptureId, photoUrl, cardImageUrl, aiAnalysis{provider, model, name, confidence, …}, environment{campusId, season, timeOfDay, capturedAt, coarseLocation?}, xpAwarded, isDuplicate, isFirstOnCampus | (userId, clientCaptureId) unique · cardId |
| `collections` (OwnedCard) | ownerId, cardId, discoveryId?, imageUrl, acquiredVia(discovery/trade/reward/event), tradable, favorite, acquiredAt | (ownerId, cardId) · ownerId |
| `trades` *(P3)* | fromUser, toUser, offeredCopyIds[], requestedCopyIds[], status, resolvedAt | toUser+status |
| `missions` *(P4)* | title, description, type, requirements{category?, count, distinct?, eventId?, minLevel}, reward{xp, cardId?}, active | — |
| `missionprogress` *(P4)* | userId, missionId, progress, completedAt | (userId, missionId) unique |
| `events` *(P4)* | title, startsAt, location, minParticipants, participants[], rewardCardId, rewardXp | startsAt |
| `routes` *(P5)* | creatorId, title, checkpoints[{order, label, requiredCategory?, requiredCardId?, coarseLocation?}], distanceM, estMinutes, reward | — |
| `rewards` *(P4)* | title, partner, description, minLevel, type(deal/entry/collectible), active | minLevel |

Wishlists are stored on `users.wishlist` so "who wants this?" is a single
indexed `users.countDocuments({ wishlist: cardId })`.

## 5. API endpoints

| Method | Path | Phase |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` · GET `/api/auth/me` | 1 |
| POST | `/api/discoveries/analyze` (multipart `image`, `clientCaptureId`) | 1 |
| GET  | `/api/discoveries/mine` | 1 |
| GET  | `/api/cards` (catalog; `?category&rarity&q`) · GET `/api/cards/:id` | 1 |
| GET  | `/api/users/:id/collection` · GET `/api/users/:id/profile` | 1/2 |
| PATCH| `/api/collection/:copyId` (tradable, favorite) | 2 |
| POST | `/api/wishlist` · DELETE `/api/wishlist/:cardId` · GET `/api/users/:id/wishlist` | 3 |
| GET/POST | `/api/trades` · POST `/api/trades/:id/accept` · `/reject` | 3 |
| GET  | `/api/missions` · POST `/api/missions/:id/join` | 4 |
| GET  | `/api/events` · POST `/api/events/:id/join` | 4 |
| GET  | `/api/rewards` | 4 |
| GET/POST | `/api/routes` | 5 |

`POST /api/cards` is **not** exposed to players: cards are created only by the
discovery pipeline, or by admin/event tooling later. That stops a client from
minting cards or XP.

## 6. Frontend screens & components

```text
App
├─ LoginScreen
└─ AppShell (BottomNav)
   ├─ ExploreScreen          ← default route
   │  ├─ CameraView          video preview, capture, torch, flip, upload fallback
   │  ├─ CameraHUD           level ring, XP bar, card count, current mission
   │  └─ DiscoveryFlow       ANALYZING… → error states / CardReveal
   │     └─ CardReveal       rarity-driven (common … mythic full-screen)
   ├─ CollectionScreen       grid, rarity filters, search, sort, completion %
   ├─ CardDetailScreen       big CollectibleCard, stats, who wants it, actions
   ├─ SocialScreen (P3)      students, wishlists, tradables, trade offers
   ├─ MissionsScreen (P4) · EventsScreen (P4) · ProfileScreen (P2)
shared components: CollectibleCard, RarityBadge, XPBar, Toast
```

## 7. AI image-analysis interface

```ts
interface AIRecognitionService {
  readonly provider: string;
  analyzeImage(input: {
    image: Buffer; mimeType: string;
    context: { campusName: string; season: Season; knownCardNames: string[] };
  }): Promise<ObjectAnalysis>;
}

interface ObjectAnalysis {
  identified: boolean;        // false → "couldn't identify"
  name: string;               // "Southern Live Oak"
  canonicalName: string;      // generic, stable key used to de-duplicate cards
  category: CardCategory;     // Plant | Animal | Insect | Architecture | Landmark | Art | Sign | Food | Object | Nature | Other
  description: string;
  funFact: string;
  confidence: number;         // 0..1
  commonness: 1|2|3|4|5;      // AI's general-world estimate; ONE input to rarity
  isLandmark: boolean;
  containsPersonAsSubject: boolean; // privacy gate — we never identify people
  tags: string[];
}
```

`knownCardNames` lets the model reuse an existing catalog name ("Live Oak" vs
"Southern Live Oak"), which keeps duplicates and trading consistent.

## 8. Development phases

1. **Core discovery**: scaffold, camera, upload, AI service, card generation, Mongo, reveal. ✅ built first
2. **Collection**: auth, collection grid, card detail, XP/levels, rarity polish
3. **Social**: wishlist, tradable flag, profiles, trade proposals with server-side ownership checks
4. **Community**: missions (DB-driven), group events, rewards, achievements
5. **Exploration**: routes model + UI, route sharing, optional map

## Request lifecycle: `POST /api/discoveries/analyze`

```text
auth(JWT) → rateLimit → multer(memory, 10 MB, image/*) → controller
 → idempotency: existing discovery with (userId, clientCaptureId)? return it
 → ImageService.process      (reject non-images/tiny images; 1280px photo + 600px square card art; EXIF stripped)
 → AI.analyzeImage           (timeout; output zod-validated)
 → gates: person → 422 PERSON_DETECTED · !identified / conf < 0.4 → 422 LOW_CONFIDENCE
          (nothing is stored when a photo is rejected)
 → Storage.put ×2 → CardService.findOrCreate (atomic upsert) → RarityService
 → OwnedCard.create → Discovery.create → XPService.award ($inc, level recompute)
 → 201 DiscoveryResult { card, copy, xp, levelUp, isDuplicate, isFirstOnCampus, lowConfidence }
```
