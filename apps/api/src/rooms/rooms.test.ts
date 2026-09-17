import { randomUUID } from 'node:crypto'
import { apiErrorResponseSchema, type Room, roomListSchema, roomSchema } from '@wolfchatter/shared'
import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { buildTestApp } from '../../test/app.ts'
import { createTestDatabase, type TestDatabase } from '../../test/database.ts'
import { connectClient } from '../../test/sockets.ts'
import type { Api } from '../app.ts'

let database: TestDatabase
let api: Api

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

// A fresh app per test also means a fresh rate limiter.
beforeEach(async () => {
  await database.reset()
  api = buildTestApp(database.db)
  return () => api.app.close()
})

function createRoom(body: object) {
  return api.app.inject({ method: 'POST', url: '/api/rooms', body })
}

describe('POST /api/rooms', () => {
  it('FR-2: creates a room that the server numbers', async () => {
    const roomCreated = vi.spyOn(api.publisher, 'roomCreated')
    const id = randomUUID()

    const response = await createRoom({ id, lat: 46.7712, lng: 23.6236, number: 99 })

    expect(response.statusCode).toBe(201)
    const room = roomSchema.parse(response.json())
    expect(room).toMatchObject({ id, number: 1, lat: 46.7712, lng: 23.6236 })
    expect(roomCreated).toHaveBeenCalledExactlyOnceWith(room)
  })

  it('FR-2: rejects coordinates off the map without creating anything', async () => {
    const roomCreated = vi.spyOn(api.publisher, 'roomCreated')

    const response = await createRoom({ id: randomUUID(), lat: 91, lng: 0 })

    expect(response.statusCode).toBe(400)
    expect(apiErrorResponseSchema.parse(response.json()).error.code).toBe('VALIDATION_FAILED')
    expect(roomCreated).not.toHaveBeenCalled()
  })

  it('returns the same room when a create is retried, and publishes it again', async () => {
    const roomCreated = vi.spyOn(api.publisher, 'roomCreated')
    const body = { id: randomUUID(), lat: 10, lng: 20 }

    const first = await createRoom(body)
    const retry = await createRoom(body)

    expect(retry.statusCode).toBe(201)
    expect(retry.json()).toEqual(first.json())
    expect(roomCreated).toHaveBeenCalledTimes(2)
  })

  it('creates one room when the same create races itself', async () => {
    const body = { id: randomUUID(), lat: 10, lng: 20 }

    const responses = await Promise.all(Array.from({ length: 5 }, () => createRoom(body)))

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201, 201, 201])
    expect(new Set(responses.map((response) => response.json().number))).toEqual(new Set([1]))
  })

  it('rejects an id that another room already uses', async () => {
    const id = randomUUID()
    await createRoom({ id, lat: 10, lng: 20 })

    const response = await createRoom({ id, lat: -10, lng: -20 })

    expect(response.statusCode).toBe(409)
    expect(apiErrorResponseSchema.parse(response.json())).toEqual({
      error: { code: 'CONFLICT', message: 'This chatroom id is already used by another chatroom' },
    })
  })

  it('FR-7: pushes the new room to connected clients', async () => {
    const client = await connectClient(await api.app.listen({ host: '127.0.0.1', port: 0 }))
    const pushed = new Promise<Room>((resolve) => client.once('room:created', resolve))

    const response = await createRoom({ id: randomUUID(), lat: 0, lng: 0 })

    expect(await pushed).toEqual(response.json())
    client.disconnect()
  })
})

describe('GET /api/rooms', () => {
  it('FR-6: lists stored rooms in the order they were created', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    for (const id of ids) await createRoom({ id, lat: 1, lng: 2 })
    // Postgres stores an updated row as a new version after the others, so reading the table in
    // storage order would now return the first room last.
    await database.db.execute(sql`UPDATE rooms SET lat = 3 WHERE number = 1`)

    const response = await api.app.inject({ method: 'GET', url: '/api/rooms' })

    expect(response.statusCode).toBe(200)
    const rooms = roomListSchema.parse(response.json())
    expect(rooms.map((room) => [room.id, room.number])).toEqual([
      [ids[0], 1],
      [ids[1], 2],
      [ids[2], 3],
    ])
  })

  it('keeps the newest chatrooms, oldest-first, once past the limit', async () => {
    const limited = buildTestApp(database.db, { roomsListLimit: 2 })
    onTestFinished(() => limited.app.close())
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    for (const id of ids) await createRoom({ id, lat: 1, lng: 2 })

    const response = await limited.app.inject({ method: 'GET', url: '/api/rooms' })

    expect(response.statusCode).toBe(200)
    const rooms = roomListSchema.parse(response.json())
    expect(rooms.map((room) => room.number)).toEqual([2, 3])
  })

  it('returns everything, unchanged, when the count is under the limit', async () => {
    const limited = buildTestApp(database.db, { roomsListLimit: 5 })
    onTestFinished(() => limited.app.close())
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    for (const id of ids) await createRoom({ id, lat: 1, lng: 2 })

    const response = await limited.app.inject({ method: 'GET', url: '/api/rooms' })

    expect(response.statusCode).toBe(200)
    const rooms = roomListSchema.parse(response.json())
    expect(rooms.map((room) => room.number)).toEqual([1, 2, 3])
  })
})
