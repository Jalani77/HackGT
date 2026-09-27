import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CARD_CATEGORIES } from '../../../shared/types';

const checkpointSchema = new Schema(
  {
    order: { type: Number, required: true },
    label: { type: String, required: true, maxlength: 40 },
    hint: { type: String, default: '', maxlength: 120 },
    // Public, landmark-level description only. Future: a coarse (grid-snapped) point for maps.
    area: { type: String, default: '', maxlength: 40 },
    // What to photograph: a specific catalog card, any card in a category, or (neither) anything.
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', default: null },
    category: { type: String, enum: [...CARD_CATEGORIES, null], default: null },
  },
  { _id: false },
);

/**
 * A Strava-style exploration route: an ordered list of discovery checkpoints. Following it
 * means photographing each checkpoint in order; RouteService advances runs from discoveries.
 */
const routeSchema = new Schema(
  {
    campusId: { type: String, required: true, index: true },
    key: { type: String, default: null }, // stable slug for seeded/official routes
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    official: { type: Boolean, default: false },
    title: { type: String, required: true, maxlength: 50 },
    description: { type: String, default: '', maxlength: 300 },
    checkpoints: { type: [checkpointSchema], required: true },
    distanceM: { type: Number, default: null },
    estMinutes: { type: Number, default: null },
    reward: {
      xp: { type: Number, default: 150 },
      cardId: { type: Schema.Types.ObjectId, ref: 'Card', default: null },
    },
    stats: {
      starts: { type: Number, default: 0 },
      completions: { type: Number, default: 0 },
    },
    active: { type: Boolean, default: true },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

routeSchema.index({ campusId: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });

export type RouteFields = InferSchemaType<typeof routeSchema>;
export type RouteDoc = HydratedDocument<RouteFields>;
export const Route = model('Route', routeSchema);

/** One student following one route. */
const routeRunSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    // Index of the next checkpoint. Updates are conditional on it, so one discovery can't
    // advance the same run twice under concurrency.
    nextIndex: { type: Number, default: 0 },
    hits: {
      type: [{ order: Number, discoveryId: Schema.Types.ObjectId, cardId: Schema.Types.ObjectId, at: Date }],
      default: [],
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'routeruns' },
);

routeRunSchema.index({ userId: 1, status: 1 });
// At most one in-progress run of a given route per student.
routeRunSchema.index({ userId: 1, routeId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export type RouteRunDoc = HydratedDocument<InferSchemaType<typeof routeRunSchema>>;
export const RouteRun = model('RouteRun', routeRunSchema);
