import { z } from 'zod'
import { DEFAULT_MESSAGES_PER_MINUTE, DEFAULT_ROOMS_PER_MINUTE } from './http/limits.ts'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const PROXY_RANGE_NAMES = ['loopback', 'linklocal', 'uniquelocal'] as const

/** Splits a comma-separated variable, ignoring blanks. */
const list = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

/** A whole number of requests a minute, at least one. */
const perMinute = (fallback: number) => z.coerce.number().int().min(1).default(fallback)

/** 127.0.0.0/8, `::1`, and the literal name `localhost` — reached without a network in between. */
function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const firstOctet = /^(\d{1,3})\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.exec(hostname)?.[1]
  return firstOctet !== undefined && Number(firstOctet) === 127
}

/**
 * A deployed database must ask `pg` to verify its certificate chain. `pg` currently treats
 * Neon's `sslmode=require` as `verify-full`, but after pg v9 the same string means libpq's
 * unverified `require`, silently downgrading production TLS with no error and no failing test
 * (see worklog/2026-09-16T0555-pg-treats-sslmode-require-as-verify-full-until-it-doesn-t.md).
 * Spelling out `verify-full` survives that change. Loopback is exempt: nothing sits between the
 * API and a local Postgres for a certificate to protect against.
 */
function hasVerifiedTlsOrIsLoopback(value: string): boolean {
  const url = new URL(value)
  return isLoopbackHost(url.hostname) || url.searchParams.get('sslmode') === 'verify-full'
}

/** Environment variables the API reads. Everything except DATABASE_URL has a default. */
export const envSchema = z.object({
  DATABASE_URL: z
    .url({
      protocol: /^postgres(ql)?$/,
      error: 'DATABASE_URL must be a postgres:// URL',
    })
    .refine(hasVerifiedTlsOrIsLoopback, {
      error: 'DATABASE_URL must set sslmode=verify-full for a non-loopback host',
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
  /**
   * Per-client write limits a minute. The PRD's values are the defaults, so a normal run and a
   * deploy are unchanged; the end-to-end suite raises them, because its tests share one address.
   */
  RATE_LIMIT_ROOMS_PER_MINUTE: perMinute(DEFAULT_ROOMS_PER_MINUTE),
  RATE_LIMIT_MESSAGES_PER_MINUTE: perMinute(DEFAULT_MESSAGES_PER_MINUTE),
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
