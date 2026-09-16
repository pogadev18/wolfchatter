import type { QueryClient } from '@tanstack/react-query'
import type { Message, Room } from '@wolfchatter/shared'
import { addMessageToCache, messagesKey } from '../messages/messages-cache.ts'
import { roomsKey, upsertRooms } from '../rooms/rooms-cache.ts'
import type { AppSocket } from './socket.ts'

/** How long a join waits for its acknowledgement. A join that times out is retried on reconnect. */
const JOIN_TIMEOUT_MS = 5_000

export interface RealtimeSync {
  /** Follows the selected chatroom: joins it, and leaves the one selected before. */
  followRoom(roomId: string | undefined): void
  dispose(): void
}

/**
 * Writes pushed chatrooms and messages into the query cache (PRD §5). Pushes are best effort, so
 * after every connection it refetches the chatroom list, re-joins the open chatroom, and refetches
 * its messages only once the join is acknowledged: a message sent before that moment is in the
 * refetch, and one sent after it is pushed (PRD §4).
 */
export function createRealtimeSync(socket: AppSocket, queryClient: QueryClient): RealtimeSync {
  let roomId: string | undefined

  async function joinAndRefetch(id: string) {
    try {
      const ack = await socket.timeout(JOIN_TIMEOUT_MS).emitWithAck('room:join', id)
      if (!ack.ok || roomId !== id) return
      await queryClient.invalidateQueries({ queryKey: messagesKey(id), exact: true })
    } catch {
      // The acknowledgement timed out, so the connection is gone: the next `connect` joins again.
    }
  }

  function onConnect() {
    void queryClient.invalidateQueries({ queryKey: roomsKey, exact: true })
    if (roomId) void joinAndRefetch(roomId)
  }

  function onRoomCreated(room: Room) {
    queryClient.setQueryData<Room[]>(roomsKey, (rooms) => upsertRooms(rooms, [room]))
  }

  function onMessageCreated(message: Message) {
    addMessageToCache(queryClient, message)
  }

  socket.on('connect', onConnect)
  socket.on('room:created', onRoomCreated)
  socket.on('message:created', onMessageCreated)

  return {
    followRoom(next) {
      if (next === roomId) return
      const previous = roomId
      roomId = next
      // While disconnected, the next `connect` joins the chatroom selected by then.
      if (!socket.connected) return
      if (previous) socket.emit('room:leave', previous, ignoreAck)
      if (next) void joinAndRefetch(next)
    },
    dispose() {
      socket.off('connect', onConnect)
      socket.off('room:created', onRoomCreated)
      socket.off('message:created', onMessageCreated)
    },
  }
}

/** Leaving cannot fail in a way the client could act on. */
function ignoreAck() {}
