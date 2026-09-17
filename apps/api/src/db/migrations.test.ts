import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import { connectForMigrations, MIGRATION_LOCK_TIMEOUT_MS } from './migrations.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

describe('connectForMigrations', () => {
  it('defaults the lock timeout to 2 seconds', () => {
    expect(MIGRATION_LOCK_TIMEOUT_MS).toBe(2_000)
  })

  it('connects with no statement timeout and the migration lock timeout', async () => {
    const { db, pool } = connectForMigrations(database.url, (error) => {
      throw error
    })
    onTestFinished(() => pool.end())

    const { rows } = await db.execute(
      sql`SELECT current_setting('statement_timeout') AS statement_timeout,
                 current_setting('lock_timeout') AS lock_timeout`,
    )

    // What Postgres itself reports for the session, so this proves the settings reached the server.
    expect(rows).toEqual([{ statement_timeout: '0', lock_timeout: '2s' }])
  })
})
