import { randomUUID } from 'node:crypto'
import { apiErrorResponseSchema } from '@wolfchatter/shared'
import type { InjectOptions, LightMyRequestResponse } from 'fastify'
import { beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { buildTestApp } from '../../test/app.ts'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import type { Api, AppOptions } from '../app.ts'

const WEB_ORIGIN = 'https://wolfchatter.netlify.app'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

beforeEach(() => database.reset())

/** A fresh app, and so fresh rate-limit counters, closed when the test ends. */
function startApp(overrides: Partial<AppOptions> = {}): Api {
  const api = buildTestApp(database.db, overrides)
  onTestFinished(() => api.app.close())
  return api
}

function createRoom(api: Api, request: Partial<InjectOptions> = {}) {
  return api.app.inject({
    method: 'POST',
    url: '/api/rooms',
    body: { id: randomUUID(), lat: 0, lng: 0 },
    ...request,
  })
}

/** Sends `count` requests one after another and returns the responses. */
async function sendMany(count: number, send: (index: number) => Promise<LightMyRequestResponse>) {
  const responses: LightMyRequestResponse[] = []
  for (let index = 0; index < count; index++) responses.push(await send(index))
  return responses
}

const statusCodes = (responses: LightMyRequestResponse[]) =>
  responses.map((response) => response.statusCode)

describe('rate limits', () => {
  it('allows 10 new chatrooms a minute per client', async () => {
    const api = startApp()

    const responses = await sendMany(11, () => createRoom(api))

    expect(statusCodes(responses)).toEqual([...Array(10).fill(201), 429])
    const limited = responses[10]
    expect(apiErrorResponseSchema.parse(limited?.json()).error.code).toBe('RATE_LIMITED')
    expect(limited?.headers['retry-after']).toBeDefined()
  })

  it('allows 30 messages a minute per client, across chatrooms', async () => {
    const api = startApp()
    const roomIds = [(await createRoom(api)).json().id, (await createRoom(api)).json().id]

    const responses = await sendMany(31, (index) =>
      api.app.inject({
        method: 'POST',
        url: `/api/rooms/${roomIds[index % 2]}/messages`,
        body: { id: randomUUID(), author: 'ana', body: `message ${index}` },
      }),
    )

    expect(statusCodes(responses)).toEqual([...Array(30).fill(201), 429])
  })

  it('counts invalid requests too', async () => {
    const api = startApp()

    const responses = await sendMany(11, () => createRoom(api, { body: { id: 'not-a-uuid' } }))

    expect(statusCodes(responses)).toEqual([...Array(10).fill(400), 429])
  })

  it('counts each client address separately', async () => {
    const api = startApp()
    await sendMany(10, () => createRoom(api, { remoteAddress: '198.51.100.1' }))

    expect((await createRoom(api, { remoteAddress: '198.51.100.1' })).statusCode).toBe(429)
    expect((await createRoom(api, { remoteAddress: '198.51.100.2' })).statusCode).toBe(201)
  })
})

describe('proxy trust', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    const api = startApp()

    const responses = await sendMany(11, (index) =>
      createRoom(api, {
        remoteAddress: '198.51.100.1',
        headers: { 'x-forwarded-for': `203.0.113.${index}` },
      }),
    )

    expect(statusCodes(responses).at(-1)).toBe(429)
  })

  it('uses the address a trusted proxy appended, not the ones a client made up', async () => {
    const api = startApp({ trustedProxies: ['10.0.0.0/8'] })
    const viaProxy = (forwardedFor: string) =>
      createRoom(api, { remoteAddress: '10.1.2.3', headers: { 'x-forwarded-for': forwardedFor } })

    const spoofed = await sendMany(11, (index) => viaProxy(`192.0.2.${index}, 203.0.113.7`))

    expect(statusCodes(spoofed).at(-1)).toBe(429)
    expect((await viaProxy('203.0.113.8')).statusCode).toBe(201)
  })
})

// The M2 review asked for IPv6 clients to be bucketed by /64. `@fastify/rate-limit`'s default
// keyGenerator already does this (verified in the installed package's source and its own test
// suite), so these are regression pins for behaviour `ipv6Subnet: 64` in security.ts only makes
// explicit, not a finding fixed here. There was no RED phase: each test already passed before
// that line was added, because the default is also 64.
describe('IPv6 rate-limit buckets', () => {
  const trustedProxyApp = () => startApp({ trustedProxies: ['10.0.0.0/8'] })

  it('shares a bucket for two addresses inside one /64', async () => {
    const api = trustedProxyApp()
    await sendMany(10, () => createRoom(api, { remoteAddress: '2001:db8:abcd:12::1' }))

    const response = await createRoom(api, { remoteAddress: '2001:db8:abcd:12::2' })

    expect(response.statusCode).toBe(429)
  })

  it('gives an address in a different /64 its own bucket', async () => {
    const api = trustedProxyApp()
    await sendMany(10, () => createRoom(api, { remoteAddress: '2001:db8:abcd:12::1' }))

    const response = await createRoom(api, { remoteAddress: '2001:db8:abcd:13::1' })

    expect(response.statusCode).toBe(201)
  })

  it('maps an IPv4-mapped IPv6 address to the plain IPv4 bucket', async () => {
    const api = trustedProxyApp()
    await sendMany(10, () => createRoom(api, { remoteAddress: '198.51.100.7' }))

    const response = await createRoom(api, { remoteAddress: '::ffff:198.51.100.7' })

    expect(response.statusCode).toBe(429)
  })
})

describe('CORS', () => {
  it('answers preflights from allowed origins', async () => {
    const api = startApp({ corsOrigins: [WEB_ORIGIN] })

    const preflight = await api.app.inject({
      method: 'OPTIONS',
      url: '/api/rooms',
      headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST' },
    })

    expect(preflight.statusCode).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe(WEB_ORIGIN)
  })

  it('sends no CORS headers to other origins', async () => {
    const api = startApp({ corsOrigins: [WEB_ORIGIN] })

    const response = await api.app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: { origin: 'https://evil.example' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('security headers', () => {
  it('sends Helmet headers', async () => {
    const api = startApp()

    const response = await api.app.inject({ method: 'GET', url: '/api/rooms' })

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'strict-transport-security': expect.stringContaining('max-age='),
    })
  })
})
