import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { compareMessages, type Message } from '@wolfchatter/shared'
import type { ApiClient } from '../api/client.ts'

export function messagesKey(roomId: string) {
  return ['rooms', roomId, 'messages'] as const
}

/** Adds messages by id, never twice, in the order every client shows them: by time, then id. */
export function upsertMessages(
  current: readonly Message[] | undefined,
  incoming: readonly Message[],
): Message[] {
  const byId = new Map((current ?? []).map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort(compareMessages)
}

/**
 * A chatroom's newest page of messages. The page merges into the cache instead of replacing it,
 * so a message pushed or sent while the request was in flight survives the older answer.
 */
export function messagesQueryOptions(
  api: Pick<ApiClient, 'listMessages'>,
  queryClient: QueryClient,
  roomId: string,
) {
  return queryOptions({
    queryKey: messagesKey(roomId),
    queryFn: async () => {
      const page = await api.listMessages(roomId)
      // Read the cache only now: it may have gained messages while the request was in flight.
      return upsertMessages(queryClient.getQueryData<Message[]>(messagesKey(roomId)), page)
    },
  })
}

/**
 * Adds a message to its chatroom's cache, if that chatroom's messages were ever requested. A cache
 * holding only this message would pass for the whole chat and stop the first fetch.
 */
export function addMessageToCache(queryClient: QueryClient, message: Message): void {
  const key = messagesKey(message.roomId)
  if (queryClient.getQueryState(key) === undefined) return
  queryClient.setQueryData<Message[]>(key, (messages) => upsertMessages(messages, [message]))
}
