import { describe, expect, it } from 'vitest'
import { createRoomInputSchema, roomIdSchema, roomSchema, roomTitle } from './rooms.ts'

const validRoom = {
  id: '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f',
  number: 1,
  lat: 46.7712,
  lng: 23.6236,
  createdAt: '2026-09-15T10:00:00.000Z',
}

describe('roomSchema', () => {
  it('accepts a room as the API serialises it', () => {
    expect(roomSchema.parse(validRoom)).toEqual(validRoom)
  })

  it.each([
    ['a latitude above 90', { lat: 90.1 }],
    ['a latitude below -90', { lat: -90.1 }],
    ['a longitude above 180', { lng: 180.1 }],
    ['a longitude below -180', { lng: -180.1 }],
    ['a room number below 1', { number: 0 }],
    ['an id that is not a UUID', { id: 'room-1' }],
    ['a timestamp that is not ISO 8601', { createdAt: '15/09/2026' }],
    ['a timestamp without milliseconds', { createdAt: '2026-09-15T10:00:00Z' }],
  ])('rejects %s', (_case, override) => {
    expect(roomSchema.safeParse({ ...validRoom, ...override }).success).toBe(false)
  })
})

describe('createRoomInputSchema', () => {
  it('FR-2: accepts the id and coordinates of a map click', () => {
    const input = { id: validRoom.id, lat: 45.5, lng: -12.25 }
    expect(createRoomInputSchema.parse(input)).toEqual(input)
  })

  it('drops server-owned fields sent by a client', () => {
    expect(createRoomInputSchema.parse({ ...validRoom, number: 99 })).toEqual({
      id: validRoom.id,
      lat: validRoom.lat,
      lng: validRoom.lng,
    })
  })

  it('lowercases the id, as Postgres returns it', () => {
    const input = { id: validRoom.id.toUpperCase(), lat: 45.5, lng: -12.25 }
    expect(createRoomInputSchema.parse(input).id).toBe(validRoom.id)
  })
})

describe('roomIdSchema', () => {
  it('accepts a room id', () => {
    expect(roomIdSchema.parse(validRoom.id)).toBe(validRoom.id)
  })

  it('lowercases a room id, as Postgres returns it', () => {
    expect(roomIdSchema.parse(validRoom.id.toUpperCase())).toBe(validRoom.id)
  })

  it.each([
    ['a channel name', 'lobby'],
    ['a number', 42],
    ['nothing', undefined],
  ])('rejects %s', (_case, value) => {
    expect(roomIdSchema.safeParse(value).success).toBe(false)
  })
})

describe('roomTitle', () => {
  it('FR-2: formats the title shown in the chat panel', () => {
    expect(roomTitle({ number: 7 })).toBe('Chatroom 7')
  })
})
