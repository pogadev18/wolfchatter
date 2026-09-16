import type { ClientToServerEvents, ServerToClientEvents } from '@wolfchatter/shared'
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * The API's socket, over WebSockets only as the API requires: without HTTP long-polling, several
 * API instances would need no sticky sessions (PRD §4). It connects when `connect()` is called.
 */
export function createSocket(
  apiUrl: string,
  options: Partial<ManagerOptions & SocketOptions> = {},
): AppSocket {
  return io(apiUrl, { ...options, transports: ['websocket'], autoConnect: false })
}
