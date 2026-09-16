import { roomIdSchema } from '@wolfchatter/shared'

/** What `?room=` selects: nothing, a chatroom by its canonical id, or a value no chatroom has. */
export type RoomSelection =
  | { kind: 'none' }
  | { kind: 'room'; roomId: string }
  | { kind: 'invalid' }

export function parseRoomParam(value: string | null): RoomSelection {
  if (value === null || value === '') return { kind: 'none' }
  const parsed = roomIdSchema.safeParse(value)
  return parsed.success ? { kind: 'room', roomId: parsed.data } : { kind: 'invalid' }
}
