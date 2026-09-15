import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import { messages, rooms } from './schema.ts'

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

describe('database schema', () => {
  it('FR-2: numbers rooms in insert order', async () => {
    const created = await database.db
      .insert(rooms)
      .values([
        { id: randomUUID(), lat: 46.77, lng: 23.62 },
        { id: randomUUID(), lat: -33.87, lng: 151.21 },
      ])
      .returning({ number: rooms.number })

    expect(created.map((room) => room.number)).toEqual([1, 2])
  })

  it.each([
    ['latitude', { lat: 90.5, lng: 0 }, 'rooms_lat_range'],
    ['longitude', { lat: 0, lng: -180.5 }, 'rooms_lng_range'],
  ])('rejects a %s off the map', async (_axis, coordinates, constraint) => {
    const insert = database.db.insert(rooms).values({ id: randomUUID(), ...coordinates })
    await expect(insert).rejects.toMatchObject({ cause: { code: '23514', constraint } })
  })

  it('stores timestamps with millisecond precision, the precision the contract compares', async () => {
    const id = randomUUID()
    await database.db.execute(
      sql`INSERT INTO rooms (id, lat, lng, created_at) VALUES (${id}, 0, 0, '2026-09-15T10:00:00.123456Z')`,
    )
    const [room] = await database.db.select().from(rooms).where(eq(rooms.id, id))

    expect(room?.createdAt.toISOString()).toBe('2026-09-15T10:00:00.123Z')
  })

  it("deletes a room's messages together with the room", async () => {
    const roomId = randomUUID()
    await database.db.insert(rooms).values({ id: roomId, lat: 0, lng: 0 })
    await database.db
      .insert(messages)
      .values({ id: randomUUID(), roomId, author: 'ana', body: 'hello' })

    await database.db.delete(rooms).where(eq(rooms.id, roomId))

    expect(await database.db.select().from(messages).where(eq(messages.roomId, roomId))).toEqual([])
  })
})
