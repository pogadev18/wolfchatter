import type { CreateRoomInput, Room } from '@wolfchatter/shared'
import { asc, eq } from 'drizzle-orm'
import type { Database } from '../db/client.ts'
import { rooms } from '../db/schema.ts'
import { ApiError } from '../http/errors.ts'
import type { Publisher } from '../realtime/publisher.ts'

export interface RoomsService {
  list(): Promise<Room[]>
  create(input: CreateRoomInput): Promise<Room>
}

function toRoom(row: typeof rooms.$inferSelect): Room {
  const { id, number, lat, lng, createdAt } = row
  return { id, number, lat, lng, createdAt: createdAt.toISOString() }
}

export function createRoomsService(db: Database, publisher: Publisher): RoomsService {
  return {
    async list() {
      const rows = await db.select().from(rooms).orderBy(asc(rooms.number))
      return rows.map(toRoom)
    },

    /**
     * Inserts the room, or returns it unchanged when a retry sends the same id and coordinates.
     * The room is published either way: if the first attempt committed but never published,
     * the retry makes up for it, and clients ignore events for rooms they already have.
     */
    async create(input) {
      const [inserted] = await db
        .insert(rooms)
        .values(input)
        .onConflictDoNothing({ target: rooms.id })
        .returning()
      const row = inserted ?? (await findRetriedRoom(input))
      const room = toRoom(row)
      publisher.roomCreated(room)
      return room
    },
  }

  async function findRetriedRoom(input: CreateRoomInput) {
    const [existing] = await db.select().from(rooms).where(eq(rooms.id, input.id))
    if (!existing || existing.lat !== input.lat || existing.lng !== input.lng) {
      throw new ApiError(409, 'CONFLICT', 'This chatroom id is already used by another chatroom')
    }
    return existing
  }
}
