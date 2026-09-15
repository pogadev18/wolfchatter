import type { HealthResponse } from '@wolfchatter/shared'
import { sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import type { Database } from './db/client.ts'

export interface HealthOptions {
  db: Database
  commit: string | null
}

/** `GET /api/health`: 200 while the database answers, 503 when it doesn't. */
export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, { db, commit }) => {
  app.get('/health', async (request, reply) => {
    const dbUp = await db.execute(sql`SELECT 1`).then(
      () => true,
      (error: unknown) => {
        request.log.warn({ err: error }, 'Health check could not reach the database')
        return false
      },
    )
    const body: HealthResponse = { ok: dbUp, db: dbUp ? 'up' : 'down', commit }
    return reply.code(dbUp ? 200 : 503).send(body)
  })
}
