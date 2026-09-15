import { randomUUID } from 'node:crypto'
import {
  apiErrorResponseSchema,
  compareMessages,
  type Message,
  messageListSchema,
  messageSchema,
} from '@wolfchatter/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTestApp } from '../../test/app.ts'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import { connectClient } from '../../test/sockets.ts'
import type { Api } from '../app.ts'
import { messages } from '../db/schema.ts'

const NUL = String.fromCharCode(0)

let database: TestDatabase
let api: Api
let roomId: string

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

// A fresh app per test also means a fresh rate limiter.
beforeEach(async () => {
  await database.reset()
  api = buildTestApp(database.db)
  roomId = await createRoom()
  return () => api.app.close()
})

async function createRoom(): Promise<string> {
  const id = randomUUID()
  await api.app.inject({ method: 'POST', url: '/api/rooms', body: { id, lat: 0, lng: 0 } })
  return id
}

function postMessage(body: object, room = roomId) {
  return api.app.inject({ method: 'POST', url: `/api/rooms/${room}/messages`, body })
}

function listMessages(query = '', room = roomId) {
  return api.app.inject({ method: 'GET', url: `/api/rooms/${room}/messages${query}` })
}

describe('POST /api/rooms/:id/messages', () => {
  it('FR-5: stores the message with the author and text trimmed', async () => {
    const messageCreated = vi.spyOn(api.publisher, 'messageCreated')
    const id = randomUUID()

    const response = await postMessage({ id, author: '  ana ', body: ' hello \n' })

    expect(response.statusCode).toBe(201)
    const message = messageSchema.parse(response.json())
    expect(message).toMatchObject({ id, roomId, author: 'ana', body: 'hello' })
    expect(messageCreated).toHaveBeenCalledExactlyOnceWith(message)
  })

  it('FR-5: rejects a blank message with the text the form shows', async () => {
    const messageCreated = vi.spyOn(api.publisher, 'messageCreated')

    const response = await postMessage({ id: randomUUID(), author: 'ana', body: '   ' })

    expect(response.statusCode).toBe(400)
    expect(apiErrorResponseSchema.parse(response.json()).error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Write a message',
    })
    expect(messageCreated).not.toHaveBeenCalled()
  })

  it('FR-5: rejects text with a NUL character, which Postgres cannot store', async () => {
    const response = await postMessage({ id: randomUUID(), author: 'ana', body: `hel${NUL}lo` })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } })
  })

  it('FR-4: answers 404 for a chatroom that does not exist', async () => {
    const response = await postMessage(
      { id: randomUUID(), author: 'ana', body: 'hi' },
      randomUUID(),
    )

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Chatroom not found' } })
  })

  it('returns the same message when a send is retried', async () => {
    const body = { id: randomUUID(), author: 'ana', body: 'hello' }

    const first = await postMessage(body)
    const retry = await postMessage(body)

    expect(retry.statusCode).toBe(201)
    expect(retry.json()).toEqual(first.json())
    expect((await listMessages()).json()).toHaveLength(1)
  })

  it('rejects an id that another message already uses', async () => {
    const id = randomUUID()
    await postMessage({ id, author: 'ana', body: 'hello' })

    const response = await postMessage({ id, author: 'ana', body: 'edited' })

    expect(response.statusCode).toBe(409)
    expect(apiErrorResponseSchema.parse(response.json()).error.code).toBe('CONFLICT')
  })

  it('FR-7: pushes the message to clients viewing the room', async () => {
    const client = await connectClient(await api.app.listen({ host: '127.0.0.1', port: 0 }))
    await client.emitWithAck('room:join', roomId)
    const pushed = new Promise<Message>((resolve) => client.once('message:created', resolve))

    const response = await postMessage({ id: randomUUID(), author: 'ana', body: 'hello' })

    expect(await pushed).toEqual(response.json())
    client.disconnect()
  })
})

describe('GET /api/rooms/:id/messages', () => {
  /** Inserts five messages at fixed times, three of them in the same millisecond. */
  async function seedMessages(): Promise<Message[]> {
    const times = ['10:00:00.000', '10:00:01.000', '10:00:01.000', '10:00:01.000', '10:00:02.000']
    const rows = await database.db
      .insert(messages)
      .values(
        times.map((time, index) => ({
          id: randomUUID(),
          roomId,
          author: 'ana',
          body: `message ${index}`,
          createdAt: new Date(`2026-09-15T${time}Z`),
        })),
      )
      .returning()
    return rows
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
      .sort(compareMessages)
  }

  it('FR-6: lists messages oldest first, breaking ties by id', async () => {
    const seeded = await seedMessages()

    const response = await listMessages()

    expect(response.statusCode).toBe(200)
    expect(messageListSchema.parse(response.json())).toEqual(seeded)
  })

  it('pages back through older messages with a cursor', async () => {
    const seeded = await seedMessages()

    const newest = messageListSchema.parse((await listMessages('?limit=2')).json())
    const older = messageListSchema.parse(
      (await listMessages(`?limit=2&before=${newest[0]?.id}`)).json(),
    )
    const oldest = messageListSchema.parse(
      (await listMessages(`?limit=2&before=${older[0]?.id}`)).json(),
    )

    expect(oldest).toHaveLength(1)
    expect([...oldest, ...older, ...newest]).toEqual(seeded)
  })

  it('rejects a cursor from another chatroom', async () => {
    const otherRoomId = await createRoom()
    const other = await postMessage({ id: randomUUID(), author: 'ana', body: 'hi' }, otherRoomId)

    const response = await listMessages(`?before=${other.json().id}`)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: { code: 'VALIDATION_FAILED', message: 'before must be a message in this chatroom' },
    })
  })

  it('FR-4: answers 404 for a chatroom that does not exist', async () => {
    const response = await listMessages('', randomUUID())

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Chatroom not found' } })
  })
})
