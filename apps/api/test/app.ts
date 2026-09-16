import { type Api, type AppOptions, buildApp } from '../src/app.ts'
import type { Database } from '../src/db/client.ts'
import { DEFAULT_RATE_LIMITS, MAX_ROOMS_LISTED } from '../src/http/limits.ts'

/**
 * The app as most tests need it: no logger, no commit, no allowed origins, no trusted proxies,
 * and the PRD's write limits, so the rate-limit tests measure the values the API ships with.
 */
export function buildTestApp(db: Database, overrides: Partial<AppOptions> = {}): Api {
  return buildApp({
    db,
    commit: null,
    corsOrigins: [],
    trustedProxies: [],
    rateLimits: DEFAULT_RATE_LIMITS,
    roomsListLimit: MAX_ROOMS_LISTED,
    ...overrides,
  })
}
