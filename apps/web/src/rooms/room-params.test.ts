import { describe, expect, it } from 'vitest'
import { withRoomDeselected, withRoomSelected } from './room-params.ts'

describe('withRoomSelected', () => {
  it('sets the room parameter on an empty query string', () => {
    expect(withRoomSelected(new URLSearchParams(), 'abc').toString()).toBe('room=abc')
  })

  it('FR-4: keeps every other query parameter', () => {
    const current = new URLSearchParams('foo=bar&baz=qux')

    expect(withRoomSelected(current, 'abc').toString()).toBe('foo=bar&baz=qux&room=abc')
  })

  it('replaces an existing room parameter rather than duplicating it', () => {
    const current = new URLSearchParams('room=old&foo=bar')

    expect(withRoomSelected(current, 'new').toString()).toBe('room=new&foo=bar')
  })
})

describe('withRoomDeselected', () => {
  it('FR-4: clears the room parameter when it names the given id, keeping the rest', () => {
    const current = new URLSearchParams('room=abc&foo=bar')

    expect(withRoomDeselected(current, 'abc').toString()).toBe('foo=bar')
  })

  it('leaves every parameter untouched when a different chatroom is selected', () => {
    const current = new URLSearchParams('room=other&foo=bar')

    expect(withRoomDeselected(current, 'abc')).toBe(current)
  })

  it('leaves every parameter untouched when nothing is selected', () => {
    const current = new URLSearchParams('foo=bar')

    expect(withRoomDeselected(current, 'abc')).toBe(current)
  })
})
