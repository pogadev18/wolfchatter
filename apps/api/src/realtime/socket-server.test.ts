import { randomUUID } from 'node:crypto'
import type { Message, Room } from '@wolfchatter/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from '../../test/app.ts'
import { createTestDatabase } from '../../test/database.ts'
import { type ClientSocket, connectClient } from '../../test/sockets.ts'
import type { Api } from '../app.ts'

const WEB_ORIGIN = 'http://localhost:5173'

let api: Api
let url: string
const clients: ClientSocket[] = []

beforeAll(async () => {
  const database = await createTestDatabase()
  api = buildTestApp(database.db, { corsOrigins: [WEB_ORIGIN] })
  url = await api.app.listen({ host: '127.0.0.1', port: 0 })
  return async () => {
    await api.app.close()
    await database.drop()
  }
})

afterAll(() => {
  for (const client of clients) client.disconnect()
})

async function connect(options?: Parameters<typeof connectClient>[1]): Promise<ClientSocket> {
  const client = await connectClient(url, options)
  clients.push(client)
  return client
}

function room(): Room {
  return {
    id: randomUUID(),
    number: 1,
    lat: 46.7712,
    lng: 23.6236,
    createdAt: '2026-09-15T10:00:00.000Z',
  }
}

function message(roomId: string): Message {
  return {
    id: randomUUID(),
    roomId,
    author: 'ana',
    body: 'hello',
    createdAt: '2026-09-15T10:00:01.000Z',
  }
}

describe('Socket.IO fan-out', () => {
  it('FR-7: sends room:created to every connected client', async () => {
    const [first, second] = [await connect(), await connect()]
    const created = room()
    const received = Promise.all(
      [first, second].map(
        (client) => new Promise<Room>((resolve) => client.once('room:created', resolve)),
      ),
    )

    api.publisher.roomCreated(created)

    expect(await received).toEqual([created, created])
  })

  it('FR-7: sends message:created only to clients that joined the room', async () => {
    const [viewer, other] = [await connect(), await connect()]
    const [roomId, otherRoomId] = [randomUUID(), randomUUID()]
    expect(await viewer.emitWithAck('room:join', roomId)).toEqual({ ok: true })
    expect(await other.emitWithAck('room:join', otherRoomId)).toEqual({ ok: true })
    const viewerReceived = new Promise<Message>((resolve) =>
      viewer.once('message:created', resolve),
    )
    const otherReceived = new Promise<Message>((resolve) => other.once('message:created', resolve))

    const posted = message(roomId)
    const postedElsewhere = message(otherRoomId)
    api.publisher.messageCreated(posted)
    api.publisher.messageCreated(postedElsewhere)

    expect(await viewerReceived).toEqual(posted)
    // Events arrive in order, so the other client's first message proves it never got `posted`.
    expect(await otherReceived).toEqual(postedElsewhere)
  })

  it("stops sending a room's messages after room:leave", async () => {
    const client = await connect()
    const [leftRoomId, joinedRoomId] = [randomUUID(), randomUUID()]
    await client.emitWithAck('room:join', leftRoomId)
    expect(await client.emitWithAck('room:leave', leftRoomId)).toEqual({ ok: true })
    await client.emitWithAck('room:join', joinedRoomId)
    const received = new Promise<Message>((resolve) => client.once('message:created', resolve))

    const inJoinedRoom = message(joinedRoomId)
    api.publisher.messageCreated(message(leftRoomId))
    api.publisher.messageCreated(inJoinedRoom)

    expect(await received).toEqual(inJoinedRoom)
  })

  it('rejects a room id that is not a UUID', async () => {
    const client = await connect()

    const ack = await client.emitWithAck('room:join', 'lobby')

    expect(ack).toEqual({
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: 'Room ids are UUIDs' },
    })
    expect(await api.io.in('room:lobby').fetchSockets()).toHaveLength(0)
  })

  it('accepts connections from allowed browser origins only', async () => {
    await expect(connect({ extraHeaders: { origin: WEB_ORIGIN } })).resolves.toBeDefined()
    await expect(connect({ extraHeaders: { origin: 'https://evil.example' } })).rejects.toThrow()
  })

  it('accepts WebSocket connections only', async () => {
    await expect(connect({ transports: ['polling'] })).rejects.toThrow()
  })
})
