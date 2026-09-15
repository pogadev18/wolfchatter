import type { ApiErrorResponse } from './errors.ts'
import type { Message } from './messages.ts'
import type { Room } from './rooms.ts'

/** Events the API pushes to browsers. */
export interface ServerToClientEvents {
  /** A chatroom was created. Sent to every connected client. */
  'room:created': (room: Room) => void
  /** A message was posted. Sent only to the room's channel. */
  'message:created': (message: Message) => void
}

/** The server's answer to `room:join` and `room:leave`. */
export type SubscriptionAck = { ok: true } | { ok: false; error: ApiErrorResponse['error'] }

/**
 * Events browsers send to the API. Wait for the acknowledgement before fetching a room's
 * messages, so no message falls between the fetch and the subscription.
 */
export interface ClientToServerEvents {
  'room:join': (roomId: Room['id'], ack: (result: SubscriptionAck) => void) => void
  'room:leave': (roomId: Room['id'], ack: (result: SubscriptionAck) => void) => void
}

/** Socket.IO room that receives `message:created` events for one chatroom. */
export function roomChannel(roomId: string): `room:${string}` {
  return `room:${roomId}`
}
