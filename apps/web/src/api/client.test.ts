import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiRequestError,
  createApiClient,
  describeFailure,
  isPermanentFailure,
  isTemporaryFailure,
} from './client.ts'

const room = {
  id: '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f',
  number: 1,
  lat: 46.7712,
  lng: 23.6236,
  createdAt: '2026-09-15T10:00:00.000Z',
}

const conflict = {
  code: 'CONFLICT',
  message: 'This chatroom id is already used by another chatroom',
} as const

describe('createApiClient', () => {
  it('sends a create as JSON and returns the parsed chatroom', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json(room, { status: 201 }))
    const api = createApiClient('http://api.test', { fetchFn })

    const created = await api.createRoom({ id: room.id, lat: room.lat, lng: room.lng })

    expect(created).toEqual(room)
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith('http://api.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: room.id, lat: room.lat, lng: room.lng }),
      signal: expect.any(AbortSignal),
    })
  })

  it('sends a message to its chatroom and returns the stored message', async () => {
    const input = { id: '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e', author: 'ana', body: 'hello' }
    const message = { ...input, roomId: room.id, createdAt: '2026-09-15T10:00:01.000Z' }
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json(message, { status: 201 }))
    const api = createApiClient('http://api.test', { fetchFn })

    const sent = await api.createMessage(room.id, input)

    expect(sent).toEqual(message)
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith(
      `http://api.test/api/rooms/${room.id}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: expect.any(AbortSignal),
      },
    )
  })

  it("throws the API's error with its status, code and message", async () => {
    const api = createApiClient('http://api.test', {
      fetchFn: async () => Response.json({ error: conflict }, { status: 409 }),
    })

    const failure = await api.listRooms().catch((reason: unknown) => reason)

    expect(failure).toBeInstanceOf(ApiRequestError)
    expect(failure).toMatchObject({ status: 409, ...conflict })
  })

  it('throws an INTERNAL error when an error response is not JSON from the API', async () => {
    const api = createApiClient('http://api.test', {
      fetchFn: async () => new Response('<h1>Bad gateway</h1>', { status: 502 }),
    })

    await expect(api.listRooms()).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL',
      message: 'The server answered with status 502',
    })
  })

  it('rejects a response that breaks the shared contract', async () => {
    const api = createApiClient('http://api.test', {
      fetchFn: async () => Response.json([{ id: 'room-1' }]),
    })

    await expect(api.listRooms()).rejects.toThrow(/Invalid UUID/)
  })
})

describe('failure kinds', () => {
  const answered = (status: number) => new ApiRequestError(status, conflict)

  it.each([400, 404, 409, 413])('treats a %i answer as permanent', (status) => {
    expect(isPermanentFailure(answered(status))).toBe(true)
    expect(isTemporaryFailure(answered(status))).toBe(false)
  })

  it('lets a rate-limited request be sent again later, but not retried at once', () => {
    expect(isPermanentFailure(answered(429))).toBe(false)
    expect(isTemporaryFailure(answered(429))).toBe(false)
  })

  it.each([
    ['a 500 answer', answered(500)],
    ['a 503 answer', answered(503)],
    ['a network failure', new TypeError('Failed to fetch')],
  ])('retries %s at once', (_case, error) => {
    expect(isTemporaryFailure(error)).toBe(true)
    expect(isPermanentFailure(error)).toBe(false)
  })

  it('describes an API error by its message, and any other failure as an unreachable server', () => {
    expect(describeFailure(answered(409))).toBe(
      'This chatroom id is already used by another chatroom.',
    )
    expect(describeFailure(new TypeError('Failed to fetch'))).toBe(
      'The server could not be reached.',
    )
  })
})

describe('a request that never answers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * A real `fetch` never settles on its own here (the server on the other end of a Render cold
   * start just never replies), but it does honour the signal it was given: aborting it is the
   * only reason this promise ever rejects.
   */
  function hangingFetchFn() {
    return vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          if (!init?.signal) return
          const { signal } = init
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    )
  }

  it('gives up once the timeout elapses, on a request that carries a signal', async () => {
    const fetchFn = hangingFetchFn()
    const api = createApiClient('http://api.test', { fetchFn, timeoutMs: 10_000 })

    const failure = api.listRooms().catch((reason: unknown) => reason)
    vi.advanceTimersByTime(10_000)

    expect(await failure).toBeInstanceOf(Error)
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith('http://api.test/api/rooms', {
      signal: expect.any(AbortSignal),
    })
  })

  it('classifies a timed-out request as temporary, so it keeps its Retry button', async () => {
    const fetchFn = hangingFetchFn()
    const api = createApiClient('http://api.test', { fetchFn, timeoutMs: 10_000 })

    const failure = api.listRooms().catch((reason: unknown) => reason)
    vi.advanceTimersByTime(10_000)
    const error = await failure

    expect(isTemporaryFailure(error)).toBe(true)
    expect(isPermanentFailure(error)).toBe(false)
  })

  it('clears its timer once a request settles normally, leaving none pending', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json([]))
    const api = createApiClient('http://api.test', { fetchFn, timeoutMs: 10_000 })

    await api.listRooms()

    expect(vi.getTimerCount()).toBe(0)
  })
})
