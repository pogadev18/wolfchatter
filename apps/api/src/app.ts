import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { Database } from './db/client.ts'
import { healthRoutes } from './health.ts'
import { registerErrorHandlers } from './http/errors.ts'
import { BODY_LIMIT_BYTES } from './http/limits.ts'
import { zodValidatorCompiler } from './http/validation.ts'

export interface AppOptions {
  db: Database
  /** The deployed commit, reported by `GET /api/health`. */
  commit: string | null
  logger?: FastifyServerOptions['logger']
}

export interface Api {
  app: FastifyInstance
}

/** Builds the API without listening, so tests can `inject()` requests. */
export function buildApp(options: AppOptions): Api {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: BODY_LIMIT_BYTES })
  app.setValidatorCompiler(zodValidatorCompiler)
  registerErrorHandlers(app)

  app.register(healthRoutes, { prefix: '/api', db: options.db, commit: options.commit })
  return { app }
}
