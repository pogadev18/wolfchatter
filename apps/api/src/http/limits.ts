/** The largest request body, and socket message, the API accepts (PRD: 16 KB). */
export const BODY_LIMIT_BYTES = 16 * 1024

/** Per-client write limits from the PRD. Requests count before validation, so junk counts too. */
export const RATE_LIMITS = {
  createRoom: { max: 10, timeWindow: '1 minute' },
  createMessage: { max: 30, timeWindow: '1 minute' },
} as const
