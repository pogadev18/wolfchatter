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
    })
  })

  it('reads the port and the commit Render deploys', () => {
    const env = parseEnv({ DATABASE_URL, PORT: '10000', RENDER_GIT_COMMIT: '4f2a9c1' })
    expect(env).toMatchObject({ PORT: 10000, RENDER_GIT_COMMIT: '4f2a9c1' })
  })

  it('lists every invalid variable', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db', PORT: 'eighty' })).toThrow(
      /Invalid environment variables:\n.*DATABASE_URL must be a postgres:\/\/ URL[\s\S]*PORT/,
    )
  })
})
