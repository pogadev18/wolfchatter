/** The largest request body, and socket message, the API accepts (PRD: 16 KB). */
export const BODY_LIMIT_BYTES = 16 * 1024

/** The PRD's per-client write limits, used unless RATE_LIMIT_* raises them (see env.ts). */
export const DEFAULT_ROOMS_PER_MINUTE = 10
export const DEFAULT_MESSAGES_PER_MINUTE = 30

/** One route's limit, in the shape `@fastify/rate-limit` reads from a route's config. */
export interface RateLimit {
  max: number
  timeWindow: string
}

export interface RateLimits {
  createRoom: RateLimit
  createMessage: RateLimit
}

/** Per-client write limits. Requests count before validation, so junk counts too. */
export function rateLimits(perMinute: { rooms: number; messages: number }): RateLimits {
  return {
    createRoom: { max: perMinute.rooms, timeWindow: '1 minute' },
    createMessage: { max: perMinute.messages, timeWindow: '1 minute' },
  }
}

/** The limits the PRD names, for tests and for any caller with no environment to read. */
export const DEFAULT_RATE_LIMITS: RateLimits = rateLimits({
  rooms: DEFAULT_ROOMS_PER_MINUTE,
  messages: DEFAULT_MESSAGES_PER_MINUTE,
})
