import { createServer } from 'node:http'
import {
  type ClientToServerEvents,
  roomChannel,
  type ServerToClientEvents,
  type SubscriptionAck,
} from '@wolfchatter/shared'
import { Server } from 'socket.io'

export interface TestSocketServer {
  url: string
  io: Server<ClientToServerEvents, ServerToClientEvents>
  /** Chatroom ids that clients joined, in order. */
  joins: string[]
  /** Chatroom ids that clients left, in order. */
  leaves: string[]
  /** Holds back join acknowledgements, as a slow server would, until `releaseJoins()`. */
  holdJoins(): void
  releaseJoins(): void
  /** Closes every client's connection as a network drop would; clients then reconnect by themselves. */
  dropConnections(): void
  close(): Promise<void>
}

/** A Socket.IO server that, like the API, accepts WebSockets only and acknowledges joins and leaves. */
export async function startSocketServer(): Promise<TestSocketServer> {
  const httpServer = createServer()
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    transports: ['websocket'],
  })
  const joins: string[] = []
  const leaves: string[] = []
  let heldJoins: (() => void)[] | undefined

  io.on('connection', (socket) => {
    socket.on('room:join', (roomId, ack) => {
      joins.push(roomId)
      const acknowledge = () => {
        void socket.join(roomChannel(roomId))
        ack({ ok: true } satisfies SubscriptionAck)
      }
      if (heldJoins) heldJoins.push(acknowledge)
      else acknowledge()
    })
    socket.on('room:leave', (roomId, ack) => {
      leaves.push(roomId)
      void socket.leave(roomChannel(roomId))
      ack({ ok: true })
    })
  })

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const address = httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('The server has no port')

  return {
    url: `http://127.0.0.1:${address.port}`,
    io,
    joins,
    leaves,
    holdJoins() {
      heldJoins = []
    },
    releaseJoins() {
      const held = heldJoins ?? []
      heldJoins = undefined
      for (const acknowledge of held) acknowledge()
    },
    dropConnections() {
      for (const socket of io.sockets.sockets.values()) socket.conn.close()
    },
    close: () => io.close(),
  }
}
