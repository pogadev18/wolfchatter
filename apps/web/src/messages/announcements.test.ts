import type { Message } from '@wolfchatter/shared'
import { describe, expect, it } from 'vitest'
import { newestArrival } from './announcements.ts'

function message(id: string, author: string): Message {
  return {
    id,
    roomId: 'room',
    author,
    body: `from ${author}`,
    createdAt: '2026-09-15T10:00:00.000Z',
  }
}

const old = message('1', 'ana')
const fromBob = message('2', 'bob')
const fromCarol = message('3', 'carol')

describe('newestArrival', () => {
  it('finds the newest message that was not there before', () => {
    expect(newestArrival(new Set(['1']), [old, fromBob, fromCarol], new Set())).toEqual(fromCarol)
  })

  it("skips the user's own messages", () => {
    expect(newestArrival(new Set(['1']), [old, fromBob, fromCarol], new Set(['3']))).toEqual(
      fromBob,
    )
  })

  it('finds nothing when no message is new', () => {
    expect(newestArrival(new Set(['1', '2']), [old, fromBob], new Set())).toBeUndefined()
  })
})
