import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { RARITY_TIERS } from '../../../shared/rarity';
import { CARD_CATEGORIES } from '../../../shared/types';

/**
 * A Card is a catalog entry: "Southern Live Oak @ gatech". It is created the first time
 * anyone on a campus discovers that thing. Individual copies students hold are OwnedCards.
 */
const cardSchema = new Schema(
  {
    campusId: { type: String, required: true },
    canonicalKey: { type: String, required: true }, // normalized identity, e.g. "southern-live-oak"
    name: { type: String, required: true },
    category: { type: String, enum: CARD_CATEGORIES, required: true, index: true },
    description: { type: String, required: true },
    funFact: { type: String, required: true },
    tags: { type: [String], default: [] },
    imageUrl: { type: String, required: true }, // card art from the first discoverer
    rarity: { type: String, enum: RARITY_TIERS, required: true, index: true },
    rarityScore: { type: Number, required: true, min: 0, max: 100 },
    commonness: { type: Number, min: 1, max: 5, default: 3 }, // AI estimate, kept for re-scoring
    flags: {
      isLandmark: { type: Boolean, default: false },
      isEvent: { type: Boolean, default: false },
      requiresGroup: { type: Boolean, default: false },
      requiresMission: { type: Boolean, default: false },
      seasonal: { type: [String], default: [] }, // seasons when this card is "in season"
    },
    stats: {
      discoveryCount: { type: Number, default: 0 },
      uniqueDiscoverers: { type: Number, default: 0 },
    },
    firstDiscoveredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, enum: ['discovery', 'event', 'mission', 'route'], default: 'discovery' },
  },
  { timestamps: true },
);

cardSchema.index({ campusId: 1, canonicalKey: 1 }, { unique: true });
cardSchema.index({ campusId: 1, updatedAt: -1 });

export type CardFields = InferSchemaType<typeof cardSchema>;
export type CardDoc = HydratedDocument<CardFields>;
export const Card = model('Card', cardSchema);
