import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useServices } from '../services.tsx'
import { connectionStatusText } from './connection-status.ts'
import { createRealtimeSync, type RealtimeSync } from './realtime-sync.ts'

/** How long the first connection may take before the panel says the server is waking up. */
const WAKE_UP_NOTICE_DELAY_MS = 2_000

/** Owns the socket (PRD §5): connects it, follows the selected chatroom and fills the cache. */
export function useRealtime(roomId: string | undefined): void {
  const { socket } = useServices()
  const queryClient = useQueryClient()
  const [sync, setSync] = useState<RealtimeSync>()

  useEffect(() => {
    const created = createRealtimeSync(socket, queryClient)
    setSync(created)
    socket.connect()
    return () => {
      created.dispose()
      socket.disconnect()
    }
  }, [socket, queryClient])

  useEffect(() => {
    sync?.followRoom(roomId)
  }, [sync, roomId])
}

/** "Connected", "Reconnecting…", or "Waking up the server…" while a cold start delays the first connection. */
export function useConnectionStatusText(): string {
  const { connectionStatus } = useServices()
  const status = useSyncExternalStore(connectionStatus.subscribe, connectionStatus.getSnapshot)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), WAKE_UP_NOTICE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return connectionStatusText(status, slow)
}
