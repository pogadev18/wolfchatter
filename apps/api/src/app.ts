import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { Database } from './db/client.ts'
import { healthRoutes } from './health.ts'
import { registerErrorHandlers } from './http/errors.ts'
import { BODY_LIMIT_BYTES } from './http/limits.ts'
import { registerSecurity } from './http/security.ts'
import { zodValidatorCompiler } from './http/validation.ts'
import { messageRoutes } from './messages/routes.ts'
import { createMessagesService } from './messages/service.ts'
import type { Publisher } from './realtime/publisher.ts'
import { createSocketServer, type SocketServer } from './realtime/socket-server.ts'
import { roomRoutes } from './rooms/routes.ts'
import { createRoomsService } from './rooms/service.ts'

export interface AppOptions {
  db: Database
  /** The deployed commit, reported by `GET /api/health`. */
  commit: string | null
  /** Browser origins allowed to call the API and open sockets. */
  corsOrigins: readonly string[]
  /** Proxies trusted to report the client address in X-Forwarded-For; empty trusts none. */
  trustedProxies: readonly string[]
  logger?: FastifyServerOptions['logger']
}

export interface Api {
  app: FastifyInstance
  io: SocketServer
  publisher: Publisher
}

/** Builds the API without listening, so tests can `inject()` requests. */
export function buildApp(options: AppOptions): Api {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: BODY_LIMIT_BYTES,
    // An allowlist, never a hop count: Fastify ignores hop counts, and `true` trusts spoofed headers.
    trustProxy: options.trustedProxies.length > 0 ? [...options.trustedProxies] : false,
  })
  app.setValidatorCompiler(zodValidatorCompiler)
  registerErrorHandlers(app)
  registerSecurity(app, { corsOrigins: options.corsOrigins })

  const { io, publisher } = createSocketServer(app.server, { corsOrigins: options.corsOrigins })
  // Open WebSockets would keep the HTTP server from closing, so disconnect them first.
  app.addHook('preClose', async () => {
    io.local.disconnectSockets(true)
  })
  app.addHook('onClose', async () => {
    await io.close()
  })

  app.register(healthRoutes, { prefix: '/api', db: options.db, commit: options.commit })
  app.register(roomRoutes, { prefix: '/api', rooms: createRoomsService(options.db, publisher) })
  app.register(messageRoutes, {
    prefix: '/api',
    messages: createMessagesService(options.db, publisher),
  })
  return { app, io, publisher }
}
