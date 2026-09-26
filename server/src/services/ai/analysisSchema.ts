import { z } from 'zod';
import { CARD_CATEGORIES } from '../../../../shared/types';
import type { ObjectAnalysis } from './AIRecognitionService';

/**
 * AI output is untrusted input: validate and clamp it before it can become a card.
 * Also exported as JSON Schema for providers that support structured output.
 */
export const objectAnalysisSchema = z.object({
  identified: z.boolean(),
  name: z.string().trim().max(80),
  canonicalName: z.string().trim().max(80),
  category: z.enum(CARD_CATEGORIES).catch('Other'),
  description: z.string().trim().max(400),
  funFact: z.string().trim().max(300),
  confidence: z.number().transform((n) => Math.min(1, Math.max(0, n))),
  commonness: z
    .number()
    .int()
    .transform((n) => Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5),
  isLandmark: z.boolean(),
  containsPersonAsSubject: z.boolean(),
  tags: z
    .array(z.string().trim().max(30))
    .transform((t) => t.slice(0, 6))
    .catch([]),
});

export function parseAnalysis(raw: unknown): ObjectAnalysis {
  return objectAnalysisSchema.parse(raw);
}

/** Strict JSON schema handed to the model (OpenAI structured outputs format). */
export const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'identified',
    'name',
    'canonicalName',
    'category',
    'description',
    'funFact',
    'confidence',
    'commonness',
    'isLandmark',
    'containsPersonAsSubject',
    'tags',
  ],
  properties: {
    identified: { type: 'boolean', description: 'false if no clear subject can be identified' },
    name: { type: 'string', description: 'Specific, friendly display name, e.g. "Southern Live Oak"' },
    canonicalName: {
      type: 'string',
      description:
        'Stable generic identity for de-duplication (species / object type / landmark name). Reuse an existing catalog name if it matches.',
    },
    category: { type: 'string', enum: [...CARD_CATEGORIES] },
    description: { type: 'string', description: 'One or two sentences, max 300 chars' },
    funFact: { type: 'string', description: 'One surprising, true, playful fact, max 200 chars' },
    confidence: { type: 'number', description: '0 to 1: how sure you are of the identification' },
    commonness: {
      type: 'integer',
      description: '1 = found almost everywhere, 3 = moderately common, 5 = very unusual to encounter',
    },
    isLandmark: { type: 'boolean', description: 'A named, specific, notable place/structure/artwork' },
    containsPersonAsSubject: { type: 'boolean', description: 'true if the main subject is a person' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Up to 6 short lowercase tags' },
  },
} as const;
