import { describe, expect, it } from 'vitest'
import { apiErrorResponseSchema } from './errors.ts'
import { healthResponseSchema } from './health.ts'

describe('apiErrorResponseSchema', () => {
  it('accepts the shared error shape with optional details', () => {
    const response = {
      error: { code: 'VALIDATION_FAILED', message: 'Invalid body', details: [{ path: 'body' }] },
    }
    expect(apiErrorResponseSchema.parse(response)).toEqual(response)
  })

  it('rejects error codes outside the contract', () => {
    const response = { error: { code: 'TEAPOT', message: 'I am a teapot' } }
    expect(apiErrorResponseSchema.safeParse(response).success).toBe(false)
  })
})

describe('healthResponseSchema', () => {
  it('allows a missing commit for local runs', () => {
    expect(healthResponseSchema.parse({ ok: true, db: 'up', commit: null })).toEqual({
      ok: true,
      db: 'up',
      commit: null,
    })
  })
})
