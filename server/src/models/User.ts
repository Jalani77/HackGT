import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    campusId: { type: String, required: true, index: true },
    // XP and level are only ever changed by XPService via atomic $inc.
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    stats: {
      discoveries: { type: Number, default: 0 },
      trades: { type: Number, default: 0 },
    },
    // Card catalog ids this student is looking for (Phase 3). Indexed for "who wants this?".
    wishlist: { type: [{ type: Schema.Types.ObjectId, ref: 'Card' }], default: [], index: true },
    achievements: { type: [{ key: String, unlockedAt: Date }], default: [] },
  },
  { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;
export const User = model('User', userSchema);
