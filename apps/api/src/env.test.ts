import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.ts'

const DATABASE_URL = 'postgres://wolfchatter:wolfchatter@localhost:5433/wolfchatter'

describe('parseEnv', () => {
  it('applies defaults to everything but the database URL', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      DATABASE_URL,
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      TRUST_PROXY: [],
      RATE_LIMIT_ROOMS_PER_MINUTE: 10,
      RATE_LIMIT_MESSAGES_PER_MINUTE: 30,
    })
  })

  it('reads write limits that differ from the PRD, as the end-to-end run needs', () => {
    const env = parseEnv({
      DATABASE_URL,
      RATE_LIMIT_ROOMS_PER_MINUTE: '1000',
      RATE_LIMIT_MESSAGES_PER_MINUTE: '2000',
    })
    expect(env).toMatchObject({
      RATE_LIMIT_ROOMS_PER_MINUTE: 1000,
      RATE_LIMIT_MESSAGES_PER_MINUTE: 2000,
    })
  })

  it.each(['0', '-1', '1.5', 'plenty'])('rejects %j as a write limit', (limit) => {
    expect(() => parseEnv({ DATABASE_URL, RATE_LIMIT_ROOMS_PER_MINUTE: limit })).toThrow(
      /RATE_LIMIT_ROOMS_PER_MINUTE/,
    )
  })

  it('reads the port and the commit Render deploys', () => {
    const env = parseEnv({ DATABASE_URL, PORT: '10000', RENDER_GIT_COMMIT: '4f2a9c1' })
    expect(env).toMatchObject({ PORT: 10000, RENDER_GIT_COMMIT: '4f2a9c1' })
  })

  it('splits the allowed origins', () => {
    const env = parseEnv({
      DATABASE_URL,
      CORS_ORIGINS: 'https://wolfchatter.netlify.app, http://localhost:5173',
    })
    expect(env.CORS_ORIGINS).toEqual(['https://wolfchatter.netlify.app', 'http://localhost:5173'])
  })

  it.each(['https://wolfchatter.netlify.app/', 'wolfchatter.netlify.app', ''])(
    'rejects %j as an allowed origin',
    (origin) => {
      expect(() => parseEnv({ DATABASE_URL, CORS_ORIGINS: origin })).toThrow(/CORS_ORIGINS/)
    },
  )

  it('reads the trusted proxies', () => {
    const env = parseEnv({ DATABASE_URL, TRUST_PROXY: 'uniquelocal, 203.0.113.0/24, ::1' })
    expect(env.TRUST_PROXY).toEqual(['uniquelocal', '203.0.113.0/24', '::1'])
  })

  it('rejects a trusted proxy that is not an address or range', () => {
    expect(() => parseEnv({ DATABASE_URL, TRUST_PROXY: '1' })).toThrow(/TRUST_PROXY must list/)
  })

  it('lists every invalid variable', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db', PORT: 'eighty' })).toThrow(
      /Invalid environment variables:\n.*DATABASE_URL must be a postgres:\/\/ URL[\s\S]*PORT/,
    )
  })

  describe('DATABASE_URL TLS', () => {
    it('accepts a loopback IPv4 host with no sslmode', () => {
      expect(() =>
        parseEnv({ DATABASE_URL: 'postgres://wolfchatter:wolfchatter@127.0.0.1:5433/wolfchatter' }),
      ).not.toThrow()
    })

    it('accepts the IPv6 loopback address with no sslmode', () => {
      expect(() =>
        parseEnv({ DATABASE_URL: 'postgres://wolfchatter:wolfchatter@[::1]:5433/wolfchatter' }),
      ).not.toThrow()
    })

    it('accepts the literal name localhost with no sslmode', () => {
      expect(() => parseEnv({ DATABASE_URL })).not.toThrow()
    })

    it('rejects a hosted host with no sslmode, naming the fix', () => {
      expect(() =>
        parseEnv({ DATABASE_URL: 'postgres://user:pass@ep-cool-1234.aws.neon.tech/db' }),
      ).toThrow(/DATABASE_URL must set sslmode=verify-full/)
    })

    it('accepts a hosted host with sslmode=verify-full', () => {
      expect(() =>
        parseEnv({
          DATABASE_URL: 'postgres://user:pass@ep-cool-1234.aws.neon.tech/db?sslmode=verify-full',
        }),
      ).not.toThrow()
    })

    it('rejects an empty DATABASE_URL with the aggregated error, not a raw TypeError', () => {
      expect(() => parseEnv({ DATABASE_URL: '' })).toThrow(
        /Invalid environment variables:\n.*DATABASE_URL/,
      )
    })

    it('rejects a non-URL DATABASE_URL with the aggregated error, not a raw TypeError', () => {
      expect(() => parseEnv({ DATABASE_URL: 'somestring' })).toThrow(
        /Invalid environment variables:\n.*DATABASE_URL/,
      )
    })
  })
})
