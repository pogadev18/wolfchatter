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
  app.register(rateLimit, {
    global: false,
    // Pinned, not left at the library default: a future @fastify/rate-limit upgrade that changed
    // its default would silently widen or narrow every IPv6 client's bucket with no test failing.
    // Same reasoning as writing sslmode=verify-full instead of trusting what `require` means
    // today (see env.ts).
    ipv6Subnet: 64,
  })
}
