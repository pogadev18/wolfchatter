import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.ts'

const DATABASE_URL = 'postgres://wolfchatter:wolfchatter@localhost:5433/wolfchatter'

describe('parseEnv', () => {
  it('reads the database URL', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({ DATABASE_URL })
  })

  it('explains what is wrong with an invalid variable', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /Invalid environment variables:\n.*DATABASE_URL must be a postgres:\/\/ URL/,
    )
  })
})
