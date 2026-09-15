import { type Api, type AppOptions, buildApp } from '../src/app.ts'
import type { Database } from '../src/db/client.ts'

/** The app as most tests need it: no logger, no commit and no allowed origins. */
export function buildTestApp(db: Database, overrides: Partial<AppOptions> = {}): Api {
  return buildApp({ db, commit: null, corsOrigins: [], ...overrides })
}
