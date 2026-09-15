import { z } from 'zod'

export const roomSchema = z.object({
  id: z.uuid(),
  number: z.int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  createdAt: z.iso.datetime({ precision: 3 }),
})
export type Room = z.infer<typeof roomSchema>

export const roomListSchema = z.array(roomSchema)

/** A chatroom id: the payload of `room:join` and `room:leave`, and the `?room=` URL parameter. */
export const roomIdSchema = roomSchema.shape.id

/** Body of `POST /api/rooms`. The client generates the id, so retries are idempotent. */
export const createRoomInputSchema = roomSchema.pick({ id: true, lat: true, lng: true })
export type CreateRoomInput = z.infer<typeof createRoomInputSchema>

/** The panel title from the mockup, e.g. "Chatroom 2". */
export function roomTitle(room: Pick<Room, 'number'>): string {
  return `Chatroom ${room.number}`
}
