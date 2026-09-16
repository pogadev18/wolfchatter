// Entry point for `pnpm dev` and `pnpm start`. Serves the API until SIGINT or SIGTERM,
// then stops accepting connections, lets in-flight requests finish and closes the pool.
import { buildApp } from './app.ts'
import { connectDatabase } from './db/client.ts'
import { parseEnv } from './env.ts'
import { rateLimits } from './http/limits.ts'

const SHUTDOWN_TIMEOUT_MS = 10_000

const env = parseEnv(process.env)
const database = connectDatabase(env.DATABASE_URL, (error) =>
  app.log.error({ err: error }, 'Idle database connection failed'),
)
const { app } = buildApp({
  db: database.db,
  commit: env.RENDER_GIT_COMMIT ?? null,
  corsOrigins: env.CORS_ORIGINS,
  trustedProxies: env.TRUST_PROXY,
  rateLimits: rateLimits({
    rooms: env.RATE_LIMIT_ROOMS_PER_MINUTE,
    messages: env.RATE_LIMIT_MESSAGES_PER_MINUTE,
  }),
  logger: { level: env.LOG_LEVEL },
})
app.addHook('onClose', () => database.pool.end())

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'Shutting down')
    setTimeout(() => {
      app.log.error('Shutdown timed out')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS).unref()
    app.close().then(
      () => app.log.info('Server closed'),
      (error: unknown) => {
        app.log.error({ err: error }, 'Shutdown failed')
        process.exitCode = 1
      },
    )
  })
}

await app.listen({ host: env.HOST, port: env.PORT })
