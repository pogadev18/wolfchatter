import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { type Message, type Room, roomChannel } from '@wolfchatter/shared'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { startSocketServer, type TestSocketServer } from '../../test/socket-server.ts'
import { messagesKey } from '../messages/messages-cache.ts'
import { roomsKey } from '../rooms/rooms-cache.ts'
import { createRealtimeSync, type RealtimeSync } from './realtime-sync.ts'
import { type AppSocket, createSocket } from './socket.ts'

const ROOM_A = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'
const ROOM_B = '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e'

function room(number: number, id: string): Room {
  return { id, number, lat: 46.7712, lng: 23.6236, createdAt: '2026-09-15T10:00:00.000Z' }
}

const message: Message = {
  id: '11111111-1111-4111-8111-111111111111',
  roomId: ROOM_A,
  author: 'ana',
  body: 'hello',
  createdAt: '2026-09-15T10:00:01.000Z',
}

describe('createRealtimeSync', () => {
  let server: TestSocketServer
  let queryClient: QueryClient
  let socket: AppSocket
  let sync: RealtimeSync

  beforeEach(async () => {
    server = await startSocketServer()
    queryClient = new QueryClient()
    // Reconnect at once instead of after the browser's 1–5 second back-off.
    socket = createSocket(server.url, { reconnectionDelay: 10, reconnectionDelayMax: 10 })
    sync = createRealtimeSync(socket, queryClient)
  })

  afterEach(async () => {
    sync.dispose()
    socket.disconnect()
    queryClient.clear()
    await server.close()
  })

  /** Observes a query the way a mounted component does, and counts how often it fetches. */
  function watch(queryKey: readonly unknown[], data: unknown) {
    const fetches = { count: 0 }
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => {
        fetches.count++
        return data
      },
    })
    onTestFinished(observer.subscribe(() => {}))
    return fetches
  }

  async function connect() {
    const connected = new Promise<void>((resolve) => socket.once('connect', () => resolve()))
    socket.connect()
    await connected
  }

  it('FR-7: adds a pushed chatroom without dropping the ones already listed', async () => {
    queryClient.setQueryData(roomsKey, [room(1, ROOM_A)])
    await connect()

    server.io.emit('room:created', room(2, ROOM_B))

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(roomsKey)).toEqual([room(1, ROOM_A), room(2, ROOM_B)]),
    )
  })

  it('FR-7: adds a pushed message to the open chatroom', async () => {
    watch(messagesKey(ROOM_A), [])
    sync.followRoom(ROOM_A)
    await connect()
    await vi.waitFor(() => expect(server.joins).toEqual([ROOM_A]))

    server.io.to(roomChannel(ROOM_A)).emit('message:created', message)

    await vi.waitFor(() => expect(queryClient.getQueryData(messagesKey(ROOM_A))).toEqual([message]))
  })

  it('FR-7: joins the selected chatroom and leaves the one selected before', async () => {
    await connect()

    sync.followRoom(ROOM_A)
    await vi.waitFor(() => expect(server.joins).toEqual([ROOM_A]))
    sync.followRoom(ROOM_B)

    await vi.waitFor(() => expect(server.joins).toEqual([ROOM_A, ROOM_B]))
    expect(server.leaves).toEqual([ROOM_A])
  })

  it('FR-7: refetches the messages only once a join is acknowledged, after every reconnect too', async () => {
    const fetches = watch(messagesKey(ROOM_A), [])
    sync.followRoom(ROOM_A)
    server.holdJoins()

    await connect()
    await vi.waitFor(() => expect(server.joins).toEqual([ROOM_A]))
    expect(fetches.count).toBe(1)
    server.releaseJoins()
    await vi.waitFor(() => expect(fetches.count).toBe(2))

    server.holdJoins()
    server.dropConnections()
    await vi.waitFor(() => expect(server.joins).toEqual([ROOM_A, ROOM_A]))
    expect(fetches.count).toBe(2)
    server.releaseJoins()
    await vi.waitFor(() => expect(fetches.count).toBe(3))
  })

  it('FR-7: refetches the chatroom list after every reconnect', async () => {
    const fetches = watch(roomsKey, [])
    await connect()
    await vi.waitFor(() => expect(fetches.count).toBe(2))

    server.dropConnections()

    await vi.waitFor(() => expect(fetches.count).toBe(3))
  })
})
