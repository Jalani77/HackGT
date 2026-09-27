import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A level-gated perk: a partner deal, event entry, or exclusive collectible card.
 * MVP deals are mock partners, but the model carries what real ones need (partner, expiry, stock).
 */
const rewardSchema = new Schema(
  {
    campusId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    title: { type: String, required: true },
    partner: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: '🎁' },
    type: { type: String, enum: ['deal', 'entry', 'collectible'], required: true },
    minLevel: { type: Number, required: true, min: 1 },
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', default: null }, // collectible rewards
    /** null = unlimited. Decremented atomically on redemption. */
    stock: { type: Number, default: null },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

rewardSchema.index({ campusId: 1, key: 1 }, { unique: true });

export type RewardFields = InferSchemaType<typeof rewardSchema>;
export type RewardDoc = HydratedDocument<RewardFields>;
export const Reward = model('Reward', rewardSchema);

/** A student's claim on a reward. The code is what they show at the partner's counter. */
const redemptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
    code: { type: String, required: true },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

redemptionSchema.index({ userId: 1, rewardId: 1 }, { unique: true });

export const Redemption = model('Redemption', redemptionSchema);
