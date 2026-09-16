import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { type CreateRoomInput, createRoomInputSchema, type Room } from '@wolfchatter/shared'
import { useServices } from '../services.tsx'
import { roomsKey, roomsQueryOptions, upsertRooms } from './rooms-cache.ts'

const createRoomKey = ['rooms', 'create'] as const

export function useRooms() {
  const { api } = useServices()
  const queryClient = useQueryClient()
  return useQuery(roomsQueryOptions(api, queryClient))
}

export interface CreateRoomOptions {
  /** Runs for every create that fails for good, after its retries. */
  onError(error: Error, input: CreateRoomInput): void
}

/** Creates a chatroom; the query client retries temporary failures with the same id and position. */
export function useCreateRoom({ onError }: CreateRoomOptions) {
  const { api } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: createRoomKey,
    mutationFn: (input: CreateRoomInput) => api.createRoom(input),
    onSuccess: (room) => {
      queryClient.setQueryData<Room[]>(roomsKey, (rooms) => upsertRooms(rooms, [room]))
    },
    onError,
  })
}

/**
 * Chatrooms whose create is still in flight. Their pins show at once (optimistic), and disappear
 * by themselves if the create fails, because a failed create is no longer pending.
 */
export function useRoomsBeingCreated(): CreateRoomInput[] {
  const creates = useMutationState({
    filters: { mutationKey: createRoomKey, status: 'pending' },
    select: (mutation) => createRoomInputSchema.safeParse(mutation.state.variables).data,
  })
  return creates.filter((input) => input !== undefined)
}
