import { healthResponseSchema } from '@wolfchatter/shared'
import { beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { buildTestApp } from '../test/app.ts'
import { createTestDatabase, type TestDatabase } from '../test/database.ts'
import { connectDatabase } from './db/client.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

describe('GET /api/health', () => {
  it('reports the database and the deployed commit', async () => {
    const { app } = buildTestApp(database.db, { commit: '4f2a9c1' })
    onTestFinished(() => app.close())

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(healthResponseSchema.parse(response.json())).toEqual({
      ok: true,
      db: 'up',
      commit: '4f2a9c1',
    })
  })

  it('answers 503 when the database is unreachable', async () => {
    // Nothing listens on port 1, so every query fails fast.
    const unreachable = connectDatabase('postgres://wolfchatter@127.0.0.1:1/wolfchatter', () => {})
    const { app } = buildTestApp(unreachable.db)
    onTestFinished(async () => {
      await app.close()
      await unreachable.pool.end()
    })

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ ok: false, db: 'down', commit: null })
  })
})
