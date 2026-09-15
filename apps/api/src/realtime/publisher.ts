import type { Message, Room } from '@wolfchatter/shared'

/** How services announce committed changes. Only the Socket.IO module implements it. */
export interface Publisher {
  roomCreated(room: Room): void
  messageCreated(message: Message): void
}
