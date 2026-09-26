import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One copy of a card in a student's collection (stored in the `collections` collection).
 * Duplicates are separate documents, so trades simply change `ownerId` on specific copies
 * and ownership checks are a single indexed lookup.
 */
const ownedCardSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
    discoveryId: { type: Schema.Types.ObjectId, ref: 'Discovery', default: null },
    imageUrl: { type: String, required: true }, // this copy's own art (the owner's photo)
    acquiredVia: { type: String, enum: ['discovery', 'trade', 'reward', 'event'], required: true },
    xpAwarded: { type: Number, default: 0 },
    tradable: { type: Boolean, default: false },
    favorite: { type: Boolean, default: false },
    environment: {
      type: { season: String, timeOfDay: String },
      default: null,
    },
    acquiredAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'collections' },
);

ownedCardSchema.index({ ownerId: 1, cardId: 1 });

export type OwnedCardFields = InferSchemaType<typeof ownedCardSchema>;
export type OwnedCardDoc = HydratedDocument<OwnedCardFields>;
export const OwnedCard = model('OwnedCard', ownedCardSchema);
