import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { Room } from '@wolfchatter/shared'
import type { ApiClient } from '../api/client.ts'

export const roomsKey = ['rooms'] as const

/** Adds chatrooms by id, never twice, in the order the server numbered them. */
export function upsertRooms(
  current: readonly Room[] | undefined,
  incoming: readonly Room[],
): Room[] {
  const byId = new Map((current ?? []).map((room) => [room.id, room]))
  for (const room of incoming) byId.set(room.id, room)
  return [...byId.values()].sort((a, b) => a.number - b.number)
}

/**
 * Every chatroom. The list merges into the cache instead of replacing it, so a chatroom that
 * arrived while the request was in flight survives the older answer.
 */
export function roomsQueryOptions(api: Pick<ApiClient, 'listRooms'>, queryClient: QueryClient) {
  return queryOptions({
    queryKey: roomsKey,
    queryFn: async () => {
      const rooms = await api.listRooms()
      // Read the cache only now: it may have gained chatrooms while the request was in flight.
      return upsertRooms(queryClient.getQueryData<Room[]>(roomsKey), rooms)
    },
  })
}
