/** Rules for missions, group events, and routes. Tweak here, no code changes needed. */
export const communityConfig = {
  missions: {
    /** How many missions a student can have in progress at once. */
    maxActive: 5,
  },
  events: {
    /** Level needed to host your own group event. */
    hostMinLevel: 2,
    /** Upcoming events one student may host at a time. */
    maxHostedUpcoming: 3,
    /** Check-in opens this long before the start time. */
    checkInEarlyMinutes: 30,
    maxDurationMinutes: 12 * 60,
    /** How far ahead an event can be scheduled. */
    maxDaysAhead: 60,
    minParticipants: { min: 2, max: 50 },
  },
  routes: {
    /** Level needed to publish a route. */
    createMinLevel: 2,
    maxActiveRuns: 3,
    maxCreatedPerUser: 20,
    checkpoints: { min: 2, max: 8 },
  },
};
