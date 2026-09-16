import { test as base } from '@playwright/test'
import pg from 'pg'
import { E2E_DATABASE_URL } from './environment.ts'

export { expect } from '@playwright/test'

/** A 1×1 transparent PNG, served for every map tile so tests never depend on tile servers. */
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
  'base64',
)

const TILE_SERVERS = /^https:\/\/(tiles\.stadiamaps\.com|tile\.openstreetmap\.org)\//

interface Fixtures {
  /** Empties the database before each test, so every test starts with no chatrooms. */
  database: pg.Pool
  /** Serves every map tile locally. A test can still route a tile server itself. */
  tiles: undefined
}

interface WorkerFixtures {
  pool: pg.Pool
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  pool: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructuring pattern.
    async ({}, use) => {
      const pool = new pg.Pool({ connectionString: E2E_DATABASE_URL })
      await use(pool)
      await pool.end()
    },
    { scope: 'worker' },
  ],
  database: [
    async ({ pool }, use) => {
      await pool.query('TRUNCATE rooms, messages RESTART IDENTITY')
      await use(pool)
    },
    { auto: true },
  ],
  tiles: [
    async ({ context }, use) => {
      await context.route(TILE_SERVERS, (route) =>
        route.fulfill({ contentType: 'image/png', body: TILE }),
      )
      await use(undefined)
    },
    { auto: true },
  ],
})
