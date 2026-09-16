import { type Browser, test as base, type Page } from '@playwright/test'
import { type Room, roomSchema } from '@wolfchatter/shared'
import pg from 'pg'
import { E2E_DATABASE_URL } from './environment.ts'

export { expect } from '@playwright/test'

/** A 1×1 transparent PNG, served for every map tile so tests never depend on tile servers. */
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=',
  'base64',
)

const TILE_SERVERS = /^https:\/\/(tiles\.stadiamaps\.com|tile\.openstreetmap\.org)\//

export interface Database {
  /**
   * Inserts a chatroom straight into the database. Tests that only need a chatroom to exist
   * use this, because the API allows 10 creates a minute per client and every test shares one.
   */
  createRoom(position: { lat: number; lng: number }): Promise<Room>
}

interface Fixtures {
  /** The database, emptied before each test so every test starts with no chatrooms. */
  database: Database
  /** Serves every map tile locally in the test's own browser context. */
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
      await use({
        async createRoom({ lat, lng }) {
          const id = crypto.randomUUID()
          const { rows } = await pool.query<{ number: number; created_at: Date }>(
            'INSERT INTO rooms (id, lat, lng) VALUES ($1, $2, $3) RETURNING number, created_at',
            [id, lat, lng],
          )
          const [row] = rows
          if (!row) throw new Error('The insert returned no row')
          return roomSchema.parse({
            id,
            number: row.number,
            lat,
            lng,
            createdAt: row.created_at.toISOString(),
          })
        },
      })
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

/** Another user: a separate browser context, with its own storage and locally served tiles. */
export async function openAnotherBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  await context.route(TILE_SERVERS, (route) =>
    route.fulfill({ contentType: 'image/png', body: TILE }),
  )
  return context.newPage()
}
