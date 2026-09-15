import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const PROXY_RANGE_NAMES = ['loopback', 'linklocal', 'uniquelocal'] as const

/** Splits a comma-separated variable, ignoring blanks. */
const list = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

/** Environment variables the API reads. Everything except DATABASE_URL has a default. */
export const envSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'DATABASE_URL must be a postgres:// URL',
  }),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Comma-separated browser origins allowed to call the API and open sockets. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform(list)
    .pipe(
      z
        .array(
          z.string().refine((origin) => URL.canParse(origin) && new URL(origin).origin === origin, {
            error: 'CORS_ORIGINS must list origins like https://example.com, with no path',
          }),
        )
        .min(1, { error: 'CORS_ORIGINS must list at least one origin' }),
    ),
  /**
   * Proxies whose X-Forwarded-For is trusted: IPs, CIDR ranges, or loopback, linklocal and
   * uniquelocal. Empty trusts none. Never trust every hop: clients could spoof their address.
   */
  TRUST_PROXY: z
    .string()
    .default('')
    .transform(list)
    .pipe(
      z.array(
        z.union([z.enum(PROXY_RANGE_NAMES), z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()], {
          error: 'TRUST_PROXY must list IPs, CIDR ranges, loopback, linklocal or uniquelocal',
        }),
      ),
    ),
  /** Set by Render on every deploy. `GET /api/health` reports it so deploys can be verified. */
  RENDER_GIT_COMMIT: z.string().min(1).optional(),
})
export type Env = z.infer<typeof envSchema>

/** Parses the environment, or throws an error that lists every invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
