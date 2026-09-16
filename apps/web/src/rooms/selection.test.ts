import { describe, expect, it } from 'vitest'
import { parseRoomParam } from './selection.ts'

const ROOM_ID = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'

describe('parseRoomParam', () => {
  it.each([
    ['no room parameter', null],
    ['an empty one', ''],
  ])('selects nothing for %s', (_case, value) => {
    expect(parseRoomParam(value)).toEqual({ kind: 'none' })
  })

  it('FR-4: selects a chatroom by its id', () => {
    expect(parseRoomParam(ROOM_ID)).toEqual({ kind: 'room', roomId: ROOM_ID })
  })

  it('FR-4: lowercases the id, as the API returns ids', () => {
    expect(parseRoomParam(ROOM_ID.toUpperCase())).toEqual({ kind: 'room', roomId: ROOM_ID })
  })

  it('FR-4: marks a value that is not a chatroom id as invalid', () => {
    expect(parseRoomParam('lobby')).toEqual({ kind: 'invalid' })
  })
})
