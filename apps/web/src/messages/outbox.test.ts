import type { MutationState } from '@tanstack/react-query'
import type { Message } from '@wolfchatter/shared'
import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../api/client.ts'
import { type OutgoingMessage, outgoingMessage, unsentMessages } from './outbox.ts'

const ROOM_ID = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'
const input = { id: '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e', author: 'ana', body: 'hello' }

function sendState(overrides: Partial<MutationState<unknown, Error, unknown, unknown>>) {
  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: 'pending',
    variables: { roomId: ROOM_ID, input },
    submittedAt: 1_000,
    ...overrides,
  } satisfies MutationState<unknown, Error, unknown, unknown>
}

describe('outgoingMessage', () => {
  it('shows a send in flight as sending', () => {
    expect(outgoingMessage(7, sendState({ status: 'pending' }))).toEqual({
      mutationId: 7,
      roomId: ROOM_ID,
      input,
      status: 'sending',
      submittedAt: 1_000,
    })
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a server error', new ApiRequestError(503, { code: 'INTERNAL', message: 'Unavailable' })],
    ['a rate limit', new ApiRequestError(429, { code: 'RATE_LIMITED', message: 'Slow down' })],
  ])('FR-5: keeps a send that failed with %s, so it can be retried', (_case, error) => {
    expect(outgoingMessage(7, sendState({ status: 'error', error }))).toMatchObject({
      status: 'failed',
    })
  })

  it('FR-5: drops a send the API rejected for good, such as a 409', () => {
    const error = new ApiRequestError(409, { code: 'CONFLICT', message: 'Already used' })

    expect(outgoingMessage(7, sendState({ status: 'error', error }))).toBeUndefined()
  })

  it('drops a send that succeeded, which the chat shows as a stored message', () => {
    expect(outgoingMessage(7, sendState({ status: 'success' }))).toBeUndefined()
  })
})

describe('unsentMessages', () => {
  const outgoing = (id: string, submittedAt: number): OutgoingMessage => ({
    mutationId: submittedAt,
    roomId: ROOM_ID,
    input: { ...input, id },
    status: 'sending',
    submittedAt,
  })

  it('hides a send once its message is stored, and lists the rest in the order they were sent', () => {
    const storedId = '11111111-1111-4111-8111-111111111111'
    const stored: Message = {
      ...input,
      id: storedId,
      roomId: ROOM_ID,
      createdAt: '2026-09-15T10:00:00.000Z',
    }
    const later = outgoing('22222222-2222-4222-8222-222222222222', 3_000)
    const earlier = outgoing('33333333-3333-4333-8333-333333333333', 2_000)

    expect(unsentMessages([later, outgoing(storedId, 1_000), earlier], [stored])).toEqual([
      earlier,
      later,
    ])
  })
})
