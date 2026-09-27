import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const tradeItem = new Schema(
  {
    copyId: { type: Schema.Types.ObjectId, ref: 'OwnedCard', required: true },
    // Snapshot of which card the copy was, so history still renders after the copy changes hands.
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
  },
  { _id: false },
);

/**
 * A trade proposal. `offered` copies belong to fromUser, `requested` copies to toUser.
 * Ownership is re-validated when the trade is accepted, not just when it's proposed.
 */
const tradeSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offered: { type: [tradeItem], default: [] },
    requested: { type: [tradeItem], default: [] },
    message: { type: String, maxlength: 200, default: '' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'accepted', 'declined', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    statusReason: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

tradeSchema.index({ 'offered.copyId': 1, status: 1 });
tradeSchema.index({ 'requested.copyId': 1, status: 1 });

export type TradeFields = InferSchemaType<typeof tradeSchema>;
export type TradeDoc = HydratedDocument<TradeFields>;
export const Trade = model('Trade', tradeSchema);
