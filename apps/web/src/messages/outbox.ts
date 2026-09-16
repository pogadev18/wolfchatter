import type { MutationState } from '@tanstack/react-query'
import { createMessageInputSchema, type Message, roomIdSchema } from '@wolfchatter/shared'
import { z } from 'zod'
import { isPermanentFailure } from '../api/client.ts'

/** What a send's mutation carries: its exact payload, so a retry sends the same message. */
export const sendMessageVariablesSchema = z.object({
  roomId: roomIdSchema,
  input: createMessageInputSchema,
})
export type SendMessageVariables = z.infer<typeof sendMessageVariablesSchema>

export interface OutgoingMessage extends SendMessageVariables {
  /** The mutation that sent it, which a retry replaces. */
  mutationId: number
  status: 'sending' | 'failed'
  submittedAt: number
}

/**
 * A send the chat still shows below the stored messages: in flight, or failed in a way that sending
 * it again could fix (FR-5). A send that succeeded shows as a stored message, and one the API
 * rejected for good, such as a 409, is not shown at all.
 */
export function outgoingMessage(
  mutationId: number,
  state: MutationState<unknown, Error, unknown, unknown>,
): OutgoingMessage | undefined {
  const failed = state.status === 'error' && !isPermanentFailure(state.error)
  const variables = sendMessageVariablesSchema.safeParse(state.variables)
  if ((state.status !== 'pending' && !failed) || !variables.success) return undefined
  return {
    mutationId,
    ...variables.data,
    status: failed ? 'failed' : 'sending',
    submittedAt: state.submittedAt,
  }
}

/** Outgoing messages that are not stored yet, in the order they were sent. */
export function unsentMessages(
  outgoing: readonly OutgoingMessage[],
  stored: readonly Message[],
): OutgoingMessage[] {
  const storedIds = new Set(stored.map(({ id }) => id))
  return outgoing
    .filter(({ input }) => !storedIds.has(input.id))
    .sort((a, b) => a.submittedAt - b.submittedAt)
}
