import { describe, expect, it } from 'vitest'
import { parseWebEnv } from './env.ts'

describe('parseWebEnv', () => {
  it("reads the API's origin and ignores Vite's own variables", () => {
    const source = { VITE_API_URL: 'http://127.0.0.1:3000', MODE: 'production', DEV: false }

    expect(parseWebEnv(source)).toEqual({ VITE_API_URL: 'http://127.0.0.1:3000' })
  })

  it.each([
    ['missing', undefined],
    ['a path', 'https://api.example.com/api'],
    ['a trailing slash', 'https://api.example.com/'],
    ['another protocol', 'ws://api.example.com'],
  ])('explains an API URL that is %s', (_case, url) => {
    expect(() => parseWebEnv({ VITE_API_URL: url })).toThrow(
      'Invalid environment variables:\n✖ VITE_API_URL must be an origin like https://api.example.com, with no path',
    )
  })
})
