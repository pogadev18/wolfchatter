import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import { connectDatabase, STATEMENT_TIMEOUT_MS } from './client.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

describe('connectDatabase', () => {
  it('reports a dropped idle connection instead of crashing, then reconnects', async () => {
    const onIdleError = vi.fn()
    const { db, pool } = connectDatabase(database.url, onIdleError)
    onTestFinished(() => pool.end())
    const backend = await db.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)

    await database.db.execute(sql`SELECT pg_terminate_backend(${backend.rows[0]?.pid})`)

    await vi.waitFor(() => expect(onIdleError).toHaveBeenCalledOnce())
    expect(onIdleError.mock.calls[0]?.[0]).toMatchObject({ code: '57P01' })
    await expect(db.execute(sql`SELECT 1 AS one`)).resolves.toMatchObject({ rows: [{ one: 1 }] })
  })

  it('defaults the statement timeout to 5 seconds', () => {
    expect(STATEMENT_TIMEOUT_MS).toBe(5_000)
  })

  it('cancels a statement that runs past the timeout with Postgres 57014', async () => {
    // A short override keeps this real: a caller can shorten the timeout, so the test proves the
    // cancellation behaves correctly instead of waiting out the production 5-second default.
    const { db, pool } = connectDatabase(
      database.url,
      (error) => {
        throw error
      },
      200,
    )
    onTestFinished(() => pool.end())

    await expect(db.execute(sql`SELECT pg_sleep(1)`)).rejects.toMatchObject({
      cause: { code: '57014' },
    })
  })

  it('leaves a normal query unaffected by a short statement timeout', async () => {
    const { db, pool } = connectDatabase(
      database.url,
      (error) => {
        throw error
      },
      200,
    )
    onTestFinished(() => pool.end())

    await expect(db.execute(sql`SELECT 1 AS one`)).resolves.toMatchObject({ rows: [{ one: 1 }] })
  })
})
