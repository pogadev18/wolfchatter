import { describe, expect, it, vi } from 'vitest'
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
    const api = createApiClient('http://api.test', fetchFn)

    const created = await api.createRoom({ id: room.id, lat: room.lat, lng: room.lng })

    expect(created).toEqual(room)
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith('http://api.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: room.id, lat: room.lat, lng: room.lng }),
    })
  })

  it('sends a message to its chatroom and returns the stored message', async () => {
    const input = { id: '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e', author: 'ana', body: 'hello' }
    const message = { ...input, roomId: room.id, createdAt: '2026-09-15T10:00:01.000Z' }
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json(message, { status: 201 }))
    const api = createApiClient('http://api.test', fetchFn)

    const sent = await api.createMessage(room.id, input)

    expect(sent).toEqual(message)
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith(
      `http://api.test/api/rooms/${room.id}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
  })

  it("throws the API's error with its status, code and message", async () => {
    const api = createApiClient('http://api.test', async () =>
      Response.json({ error: conflict }, { status: 409 }),
    )

    const failure = await api.listRooms().catch((reason: unknown) => reason)

    expect(failure).toBeInstanceOf(ApiRequestError)
    expect(failure).toMatchObject({ status: 409, ...conflict })
  })

  it('throws an INTERNAL error when an error response is not JSON from the API', async () => {
    const api = createApiClient(
      'http://api.test',
      async () => new Response('<h1>Bad gateway</h1>', { status: 502 }),
    )

    await expect(api.listRooms()).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL',
      message: 'The server answered with status 502',
    })
  })

  it('rejects a response that breaks the shared contract', async () => {
    const api = createApiClient('http://api.test', async () => Response.json([{ id: 'room-1' }]))

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
