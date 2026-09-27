import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { EVENT_KINDS } from '../../../shared/types';

const participantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    checkedInAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * A group event. The reward unlocks only once `minParticipants` students have checked in
 * with the code the host shares in person, which is what makes it a *group* activity.
 */
const eventSchema = new Schema(
  {
    campusId: { type: String, required: true },
    key: { type: String, default: null }, // stable slug for seeded/official events
    title: { type: String, required: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 400 },
    kind: { type: String, enum: EVENT_KINDS, default: 'other' },
    locationName: { type: String, required: true, maxlength: 80 },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    hostLabel: { type: String, default: '', maxlength: 40 },
    official: { type: Boolean, default: false },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    minParticipants: { type: Number, default: 3, min: 1 },
    maxParticipants: { type: Number, default: null },
    requiredDiscoveries: { type: Number, default: 0, min: 0 },
    minLevel: { type: Number, default: 1 },
    reward: {
      xp: { type: Number, default: 0 },
      cardId: { type: Schema.Types.ObjectId, ref: 'Card', default: null },
    },
    checkInCode: { type: String, required: true, select: false },
    participants: { type: [participantSchema], default: [] },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

eventSchema.index({ campusId: 1, endsAt: 1 });
eventSchema.index({ 'participants.userId': 1 });
eventSchema.index({ campusId: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });

export type EventFields = InferSchemaType<typeof eventSchema>;
export type EventDoc = HydratedDocument<EventFields>;
export const CampusEvent = model('Event', eventSchema);
