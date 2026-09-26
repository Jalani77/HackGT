/** Gates applied to AI output before a photo can become a card. */
export const discoveryConfig = {
  /** Below this, the photo is rejected with "Try getting closer." Nothing is stored. */
  minConfidence: 0.4,
  /** Below this (but above min), the card is created with a low-confidence warning. */
  warnConfidence: 0.6,
  /** Max existing catalog names passed to the AI for consistent naming. */
  knownNamesForAI: 80,
  maxUploadBytes: 10 * 1024 * 1024,
};
