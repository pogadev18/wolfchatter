import { type Api, type AppOptions, buildApp } from '../src/app.ts'
import type { Database } from '../src/db/client.ts'

/** The app as most tests need it: no logger, no commit, no allowed origins, no trusted proxies. */
export function buildTestApp(db: Database, overrides: Partial<AppOptions> = {}): Api {
  return buildApp({ db, commit: null, corsOrigins: [], trustedProxies: [], ...overrides })
}
