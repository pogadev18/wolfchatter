import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

export interface SecurityOptions {
  corsOrigins: readonly string[]
}

/** Security headers, the CORS allowlist, and the rate limiter that routes opt into. */
export function registerSecurity(app: FastifyInstance, { corsOrigins }: SecurityOptions): void {
  app.register(helmet)
  app.register(cors, { origin: [...corsOrigins] })
  app.register(rateLimit, { global: false })
}
