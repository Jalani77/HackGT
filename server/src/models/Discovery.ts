import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** One capture event: a student photographed something and the AI identified it. */
const discoverySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
    copyId: { type: Schema.Types.ObjectId, ref: 'OwnedCard', required: true },
    // Client-generated id so a retried upload (e.g. after a dropped connection) is idempotent.
    clientCaptureId: { type: String, required: true },
    photoUrl: { type: String, required: true }, // the student's original (resized, EXIF-stripped) photo
    cardImageUrl: { type: String, required: true }, // square crop used as card art
    aiAnalysis: {
      provider: String,
      model: String,
      name: String,
      canonicalName: String,
      category: String,
      description: String,
      funFact: String,
      confidence: Number,
      commonness: Number,
      isLandmark: Boolean,
      tags: [String],
    },
    environment: {
      campusId: { type: String, required: true },
      season: String,
      timeOfDay: String,
      capturedAt: Date,
      // Future: coarse (grid-snapped) location only — never precise personal location.
      coarseLocation: { type: { lat: Number, lng: Number }, default: undefined },
    },
    xpAwarded: { type: Number, default: 0 },
    isDuplicate: { type: Boolean, default: false },
    isFirstOnCampus: { type: Boolean, default: false },
  },
  { timestamps: true },
);

discoverySchema.index({ userId: 1, clientCaptureId: 1 }, { unique: true });

export type DiscoveryFields = InferSchemaType<typeof discoverySchema>;
export type DiscoveryDoc = HydratedDocument<DiscoveryFields>;
export const Discovery = model('Discovery', discoverySchema);
