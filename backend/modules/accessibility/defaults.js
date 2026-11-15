/** Config section `accessibility` (editable from the admin config editor). */
export default {
  shortcutRateLimit: {
    windowMs: 60000,
    // SOS calls per token per window (retries with the same Idempotency-Key
    // are merged anyway)
    perToken: 10,
  },
};
