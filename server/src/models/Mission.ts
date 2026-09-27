import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { RARITY_TIERS } from '../../../shared/rarity';
import { CARD_CATEGORIES, MISSION_OBJECTIVES } from '../../../shared/types';

/**
 * A mission definition. Entirely data-driven: MissionService interprets `requirements`
 * generically, so new missions are new documents, not new code.
 */
const missionSchema = new Schema(
  {
    campusId: { type: String, required: true, index: true },
    key: { type: String, required: true }, // stable slug so re-seeding keeps players' progress
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: '🎯' },
    requirements: {
      objective: { type: String, enum: MISSION_OBJECTIVES, required: true },
      count: { type: Number, required: true, min: 1 },
      category: { type: String, enum: [...CARD_CATEGORIES, null], default: null },
      minRarity: { type: String, enum: [...RARITY_TIERS, null], default: null },
      landmarkOnly: { type: Boolean, default: false },
      newCardsOnly: { type: Boolean, default: false },
      distinct: { type: Boolean, default: false },
    },
    minLevel: { type: Number, default: 1 },
    reward: {
      xp: { type: Number, default: 100 },
      cardId: { type: Schema.Types.ObjectId, ref: 'Card', default: null },
    },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

missionSchema.index({ campusId: 1, key: 1 }, { unique: true });

export type MissionFields = InferSchemaType<typeof missionSchema>;
export type MissionDoc = HydratedDocument<MissionFields>;
export const Mission = model('Mission', missionSchema);

/** One student's progress on one mission. Created when they join it. */
const missionProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    missionId: { type: Schema.Types.ObjectId, ref: 'Mission', required: true },
    progress: { type: Number, default: 0 },
    // Keys of activities already counted (card ids for distinct missions, activity ids otherwise),
    // so the same discovery/trade can never count twice.
    counted: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'missionprogress' },
);

missionProgressSchema.index({ userId: 1, missionId: 1 }, { unique: true });
missionProgressSchema.index({ userId: 1, status: 1 });

export type MissionProgressDoc = HydratedDocument<InferSchemaType<typeof missionProgressSchema>>;
export const MissionProgress = model('MissionProgress', missionProgressSchema);
