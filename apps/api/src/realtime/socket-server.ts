import type { Server as HttpServer } from 'node:http'
import {
  type ClientToServerEvents,
  roomChannel,
  roomIdSchema,
  type ServerToClientEvents,
  type SubscriptionAck,
} from '@wolfchatter/shared'
import { Server } from 'socket.io'
import { BODY_LIMIT_BYTES } from '../http/limits.ts'
import type { Publisher } from './publisher.ts'

export type SocketServer = Server<ClientToServerEvents, ServerToClientEvents>

export interface SocketServerOptions {
  /** Browser origins allowed to connect, the same list CORS uses. */
  corsOrigins: readonly string[]
}

/**
 * Attaches Socket.IO to the API's HTTP server. WebSocket-only transport means a future
 * multi-instance setup needs no sticky sessions (PRD §4).
 */
export function createSocketServer(
  httpServer: HttpServer,
  { corsOrigins }: SocketServerOptions,
): { io: SocketServer; publisher: Publisher } {
  const io: SocketServer = new Server(httpServer, {
    transports: ['websocket'],
    serveClient: false,
    maxHttpBufferSize: BODY_LIMIT_BYTES,
    // Browsers always send Origin on WebSocket handshakes but never enforce CORS on them.
    allowRequest: (request, callback) => {
      const { origin } = request.headers
      callback(null, origin === undefined || corsOrigins.includes(origin))
    },
  })

  io.on('connection', (socket) => {
    socket.on(
      'room:join',
      subscription((channel) => socket.join(channel)),
    )
    socket.on(
      'room:leave',
      subscription((channel) => socket.leave(channel)),
    )
  })

  const publisher: Publisher = {
    roomCreated(room) {
      io.emit('room:created', room)
    },
    messageCreated(message) {
      io.to(roomChannel(message.roomId)).emit('message:created', message)
    },
  }
  return { io, publisher }
}

/** Validates a join or leave payload, applies it and acknowledges the result. */
function subscription(apply: (channel: `room:${string}`) => void | Promise<void>) {
  return async (roomId: unknown, ack: unknown) => {
    const acknowledge = (result: SubscriptionAck) => {
      if (typeof ack === 'function') ack(result)
    }
    const parsed = roomIdSchema.safeParse(roomId)
    if (!parsed.success) {
      return acknowledge({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'Room ids are UUIDs' },
      })
    }
    await apply(roomChannel(parsed.data))
    acknowledge({ ok: true })
  }
}
