import { QueryClient } from '@tanstack/react-query'
import type { Message } from '@wolfchatter/shared'
import { describe, expect, it } from 'vitest'
import {
  addMessageToCache,
  messagesKey,
  messagesQueryOptions,
  upsertMessages,
} from './messages-cache.ts'

const ROOM_ID = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'

function message(id: string, createdAt: string): Message {
  return { id, roomId: ROOM_ID, author: 'ana', body: `message ${id}`, createdAt }
}

const first = message('00000000-0000-4000-8000-00000000000a', '2026-09-15T10:00:00.000Z')
const tiedLow = message('00000000-0000-4000-8000-000000000001', '2026-09-15T10:00:01.000Z')
const tiedHigh = message('00000000-0000-4000-8000-000000000002', '2026-09-15T10:00:01.000Z')

describe('upsertMessages', () => {
  it('FR-6: orders messages by time, then by id, as the API does', () => {
    expect(upsertMessages([tiedHigh], [tiedLow, first])).toEqual([first, tiedLow, tiedHigh])
  })

  it('FR-7: never shows a message twice, such as a send and its real-time echo', () => {
    expect(upsertMessages([first, tiedLow], [tiedLow])).toEqual([first, tiedLow])
  })
})

describe('messagesQueryOptions', () => {
  it('FR-7: keeps a message that reached the cache while the page was loading', async () => {
    const queryClient = new QueryClient()
    const page = Promise.withResolvers<Message[]>()
    const api = { listMessages: () => page.promise }

    const loading = queryClient.fetchQuery(messagesQueryOptions(api, queryClient, ROOM_ID))
    queryClient.setQueryData(messagesKey(ROOM_ID), [tiedHigh])
    page.resolve([first, tiedLow])

    await expect(loading).resolves.toEqual([first, tiedLow, tiedHigh])
  })
})

describe('addMessageToCache', () => {
  it('adds a message to a chatroom whose messages are loaded or loading', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(messagesKey(ROOM_ID), [first])

    addMessageToCache(queryClient, tiedLow)

    expect(queryClient.getQueryData(messagesKey(ROOM_ID))).toEqual([first, tiedLow])
  })

  it('leaves alone a chatroom whose messages were never fetched, so its first fetch still runs', () => {
    const queryClient = new QueryClient()

    addMessageToCache(queryClient, tiedLow)

    expect(queryClient.getQueryState(messagesKey(ROOM_ID))).toBeUndefined()
  })
})
