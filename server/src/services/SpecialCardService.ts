import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { RARITY_DISPLAY, type Rarity } from '../../../shared/rarity';
import type { CardCategory, CardSource } from '../../../shared/types';
import { Card, type CardDoc } from '../models/Card';
import { RarityService } from './RarityService';
import { storageService } from './storage';

export interface SpecialCardDef {
  /** Stable slug. Stored as canonicalKey "special--<key>", which a photo can never produce. */
  key: string;
  name: string;
  category: CardCategory;
  description: string;
  funFact: string;
  tags: string[];
  source: Exclude<CardSource, 'discovery'>;
  earnHint: string;
  commonness: 1 | 2 | 3 | 4 | 5;
  flags?: { isEvent?: boolean; requiresGroup?: boolean; requiresMission?: boolean; isLandmark?: boolean };
  /** Ceiling for this card's tier; the score itself still comes from RarityService. */
  maxTier: Rarity;
  /** 1–3 characters drawn on the emblem art. */
  motif: string;
}

/**
 * Special cards are rewards for missions, group events, routes, and level perks. They are
 * created by organizer tooling (the seed script today, an admin panel later), never by players,
 * and are idempotent: re-running `ensure` updates content but keeps the card id and stats.
 */
export const SpecialCardService = {
  canonicalKey: (key: string) => `special--${key}`,

  async ensure(campusId: string, def: SpecialCardDef, opts: { isSeed?: boolean } = {}): Promise<CardDoc> {
    const { rarity, rarityScore } = RarityService.score({
      commonness: def.commonness,
      category: def.category,
      priorDiscoveries: 0,
      confidence: 1,
      isLandmark: !!def.flags?.isLandmark,
      isEvent: !!def.flags?.isEvent,
      requiresGroup: !!def.flags?.requiresGroup,
      requiresMission: !!def.flags?.requiresMission,
      maxTier: def.maxTier,
    });

    const art = await emblemArt(def, rarity);
    const version = createHash('sha1').update(art).digest('hex').slice(0, 10);
    const stored = await storageService.put(`special/${def.key}.jpg`, art, 'image/jpeg');

    const card = await Card.findOneAndUpdate(
      { campusId, canonicalKey: this.canonicalKey(def.key) },
      {
        $set: {
          name: def.name,
          category: def.category,
          description: def.description,
          funFact: def.funFact,
          tags: def.tags,
          imageUrl: `${stored.url}?v=${version}`,
          imageCredit: null,
          rarity,
          rarityScore,
          commonness: def.commonness,
          'flags.isLandmark': !!def.flags?.isLandmark,
          'flags.isEvent': !!def.flags?.isEvent,
          'flags.requiresGroup': !!def.flags?.requiresGroup,
          'flags.requiresMission': !!def.flags?.requiresMission,
          source: def.source,
          earnHint: def.earnHint,
          isSeed: !!opts.isSeed,
        },
        $setOnInsert: { campusId, canonicalKey: this.canonicalKey(def.key) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return card!;
  },
};

const SOURCE_LABEL: Record<SpecialCardDef['source'], string> = {
  event: 'GROUP EVENT',
  mission: 'MISSION REWARD',
  route: 'ROUTE REWARD',
  reward: 'EXCLUSIVE',
};

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A foil "emblem" in the card's rarity color, visibly different from player photos. */
async function emblemArt(def: SpecialCardDef, rarity: Rarity): Promise<Buffer> {
  const color = RARITY_DISPLAY[rarity].color;
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const x = 320 + Math.cos(a) * 460;
    const y = 300 + Math.sin(a) * 460;
    const a2 = a + Math.PI / 48;
    return `<polygon points="320,300 ${x},${y} ${320 + Math.cos(a2) * 460},${300 + Math.sin(a2) * 460}" fill="${color}" opacity="0.10"/>`;
  }).join('');
  // Hexagon badge.
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${320 + Math.cos(a) * 180},${300 + Math.sin(a) * 180}`;
  }).join(' ');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
    <defs>
      <radialGradient id="bg" cx="50%" cy="46%" r="70%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="#12121c"/>
        <stop offset="100%" stop-color="#07070d"/>
      </radialGradient>
      <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="45%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect width="640" height="640" fill="url(#bg)"/>
    ${rays}
    <polygon points="${hex}" fill="#0b0b14" fill-opacity="0.75" stroke="url(#foil)" stroke-width="10"/>
    <circle cx="320" cy="300" r="128" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="3" stroke-dasharray="6 10"/>
    <text x="320" y="345" font-family="Arial, Helvetica, sans-serif" font-size="${def.motif.length > 2 ? 104 : 130}" font-weight="700"
      fill="url(#foil)" text-anchor="middle">${escapeXml(def.motif)}</text>
    <text x="320" y="560" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#ffffff"
      fill-opacity="0.8" text-anchor="middle" letter-spacing="8">${SOURCE_LABEL[def.source]}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

