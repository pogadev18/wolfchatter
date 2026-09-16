import { QueryClient } from '@tanstack/react-query'
import type { Room } from '@wolfchatter/shared'
import { describe, expect, it } from 'vitest'
import { roomsKey, roomsQueryOptions, upsertRooms } from './rooms-cache.ts'

function room(number: number): Room {
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    number,
    lat: 46.7712,
    lng: 23.6236,
    createdAt: '2026-09-15T10:00:00.000Z',
  }
}

describe('upsertRooms', () => {
  it('adds chatrooms and keeps them in the order the server numbered them', () => {
    expect(upsertRooms([room(3), room(1)], [room(2)])).toEqual([room(1), room(2), room(3)])
  })

  it('never lists a chatroom twice', () => {
    expect(upsertRooms([room(1), room(2)], [room(2), room(1)])).toEqual([room(1), room(2)])
  })

  it('starts from an empty cache', () => {
    expect(upsertRooms(undefined, [room(1)])).toEqual([room(1)])
  })
})

describe('roomsQueryOptions', () => {
  it('FR-2: keeps a chatroom that reached the cache while the list was loading', async () => {
    const queryClient = new QueryClient()
    const list = Promise.withResolvers<Room[]>()
    const api = { listRooms: () => list.promise }

    const loading = queryClient.fetchQuery(roomsQueryOptions(api, queryClient))
    queryClient.setQueryData(roomsKey, [room(2)])
    list.resolve([room(1)])

    await expect(loading).resolves.toEqual([room(1), room(2)])
    expect(queryClient.getQueryData(roomsKey)).toEqual([room(1), room(2)])
  })
})
