import type { AppSocket } from './socket.ts'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

export interface ConnectionStatusStore {
  subscribe(onChange: () => void): () => void
  getSnapshot(): ConnectionStatus
}

/**
 * The socket's state for `useSyncExternalStore` (PRD §5): connecting until the first connection,
 * then connected, and reconnecting whenever that connection is lost.
 */
export function createConnectionStatusStore(socket: AppSocket): ConnectionStatusStore {
  let status: ConnectionStatus = socket.connected ? 'connected' : 'connecting'
  const listeners = new Set<() => void>()

  function update(next: ConnectionStatus) {
    if (next === status) return
    status = next
    for (const listener of listeners) listener()
  }
  socket.on('connect', () => update('connected'))
  socket.on('disconnect', () => update('reconnecting'))

  return {
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    getSnapshot: () => status,
  }
}

/**
 * The panel's status line (FR-7). A first connection that takes long means a hosting cold start,
 * which on Render's free tier took 33 to 35 seconds when measured against the live API.
 */
export function connectionStatusText(status: ConnectionStatus, slow: boolean): string {
  switch (status) {
    case 'connecting':
      return slow ? 'Waking up the server…' : 'Connecting…'
    case 'connected':
      return 'Connected'
    case 'reconnecting':
      return 'Reconnecting…'
  }
}
