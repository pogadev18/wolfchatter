import type { ClientToServerEvents, ServerToClientEvents } from '@wolfchatter/shared'
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client'

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Connects a WebSocket-only client, as the web app will, and waits until it is connected. */
export async function connectClient(
  url: string,
  options: Partial<ManagerOptions & SocketOptions> = {},
): Promise<ClientSocket> {
  const socket: ClientSocket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    ...options,
  })
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
  })
  return socket
}
