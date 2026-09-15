import type { FastifyInstance } from 'fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildTestApp } from '../../test/app.ts'
import { createTestDatabase } from '../../test/database.ts'
import { ApiError } from './errors.ts'
import type { ZodTypeProvider } from './validation.ts'

let app: FastifyInstance

beforeAll(async () => {
  const database = await createTestDatabase()
  app = buildTestApp(database.db).app

  // Routes that exist only in this test, to reach each branch of the error handler.
  const typed = app.withTypeProvider<ZodTypeProvider>()
  typed.post(
    '/test/echo',
    { schema: { body: z.object({ name: z.string().trim().min(1, { error: 'Enter a name' }) }) } },
    async (request) => request.body,
  )
  typed.get('/test/missing', async () => {
    throw new ApiError(404, 'NOT_FOUND', 'Chatroom not found')
  })
  typed.get('/test/crash', async () => {
    throw new Error('connection to 10.0.0.5 refused')
  })

  return async () => {
    await app.close()
    await database.drop()
  }
})

describe('request validation', () => {
  it('hands the handler the parsed value', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      body: { name: ' ana ' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ name: 'ana' })
  })

  it('rejects an invalid body with the first problem and every detail', async () => {
    const response = await app.inject({ method: 'POST', url: '/test/echo', body: { name: '  ' } })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Enter a name',
        details: [{ path: 'body.name', message: 'Enter a name' }],
      },
    })
  })

  it('rejects malformed JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      headers: { 'content-type': 'application/json' },
      body: '{"name":',
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } })
  })

  it('rejects bodies over 16 KB', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      body: { name: 'a'.repeat(16 * 1024) },
    })
    expect(response.statusCode).toBe(413)
    expect(response.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request bodies are limited to 16 KB' },
    })
  })
})

describe('error responses', () => {
  it('passes API errors through', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/missing' })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Chatroom not found' } })
  })

  it('answers unknown routes with NOT_FOUND', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nope' })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/nope not found' },
    })
  })

  it('hides the details of unexpected errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/crash' })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL', message: 'Something went wrong' },
    })
  })
})
