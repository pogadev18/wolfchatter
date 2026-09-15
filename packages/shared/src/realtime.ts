import type { Message } from './messages.ts'
import type { Room } from './rooms.ts'

/** Events the API pushes to browsers. */
export interface ServerToClientEvents {
  /** A chatroom was created. Sent to every connected client. */
  'room:created': (room: Room) => void
  /** A message was posted. Sent only to the room's channel. */
  'message:created': (message: Message) => void
}

/** Events browsers send to the API. */
export interface ClientToServerEvents {
  'room:join': (roomId: string) => void
  'room:leave': (roomId: string) => void
}

/** Socket.IO room that receives `message:created` events for one chatroom. */
export function roomChannel(roomId: string): `room:${string}` {
  return `room:${roomId}`
}
