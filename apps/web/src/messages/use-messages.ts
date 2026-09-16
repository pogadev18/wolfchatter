import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { isPermanentFailure } from '../api/client.ts'
import { useServices } from '../services.tsx'
import { addMessageToCache, messagesQueryOptions } from './messages-cache.ts'
import { type OutgoingMessage, outgoingMessage, type SendMessageVariables } from './outbox.ts'

const sendMessageKey = ['messages', 'send'] as const

/** The chatroom's messages. `enabled` is false while the chatroom itself is still being created. */
export function useMessages(roomId: string, { enabled }: { enabled: boolean }) {
  const { api } = useServices()
  const queryClient = useQueryClient()
  return useQuery({ ...messagesQueryOptions(api, queryClient, roomId), enabled })
}

export interface SendMessageOptions {
  /** Runs for a send the API rejected for good, such as a 409 CONFLICT. */
  onRejected(error: Error): void
}

/** Sends messages; the query client retries temporary failures with the same payload. */
export function useSendMessage({ onRejected }: SendMessageOptions) {
  const { api } = useServices()
  const queryClient = useQueryClient()
  const send = useMutation({
    mutationKey: sendMessageKey,
    mutationFn: ({ roomId, input }: SendMessageVariables) => api.createMessage(roomId, input),
    onSuccess: (message) => addMessageToCache(queryClient, message),
    onError: (error) => {
      if (isPermanentFailure(error)) onRejected(error)
    },
    // A failed send stays in the chat until it is retried, instead of vanishing after 5 minutes.
    gcTime: Number.POSITIVE_INFINITY,
  })

  /** Sends a failed message again, with the same id and text, in place of the failed attempt. */
  function retry(message: OutgoingMessage) {
    const mutations = queryClient.getMutationCache()
    const failed = mutations.find({
      mutationKey: sendMessageKey,
      predicate: ({ mutationId }) => mutationId === message.mutationId,
    })
    if (failed) mutations.remove(failed)
    send.mutate({ roomId: message.roomId, input: message.input })
  }

  return { send: send.mutate, retry }
}

/** The chatroom's sends that are in flight or failed, from every send mutation still cached. */
export function useOutgoingMessages(roomId: string): OutgoingMessage[] {
  const outgoing = useMutationState({
    filters: { mutationKey: sendMessageKey },
    select: (mutation) => outgoingMessage(mutation.mutationId, mutation.state),
  })
  return outgoing.filter(
    (message): message is OutgoingMessage => message !== undefined && message.roomId === roomId,
  )
}
