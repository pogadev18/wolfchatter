import type { Room } from '@wolfchatter/shared'
import { describe, expect, it } from 'vitest'
import { panelView, ROOMS_STALE, ROOMS_UNAVAILABLE, roomsFailureText } from './panel-view.ts'

const room: Room = {
  id: '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f',
  number: 1,
  lat: 46.7712,
  lng: 23.6236,
  createdAt: '2026-09-15T10:00:00.000Z',
}
const OTHER_ID = '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e'

describe('panelView', () => {
  it('FR-3: shows the empty state when nothing is selected', () => {
    expect(panelView({ kind: 'none' }, [room], [], false)).toEqual({ kind: 'empty' })
  })

  it('FR-4: shows the selected chatroom', () => {
    expect(panelView({ kind: 'room', roomId: room.id }, [room], [], false)).toEqual({
      kind: 'room',
      room,
    })
  })

  it('FR-2: shows a chatroom whose create is still in flight', () => {
    const creating = [{ id: OTHER_ID, lat: 1, lng: 2 }]

    expect(panelView({ kind: 'room', roomId: OTHER_ID }, [room], creating, false)).toEqual({
      kind: 'creating',
      roomId: OTHER_ID,
    })
  })

  it('waits for the chatroom list before calling an id unknown', () => {
    expect(panelView({ kind: 'room', roomId: OTHER_ID }, undefined, [], false)).toEqual({
      kind: 'loading',
    })
  })

  it('FR-4: shows "Chatroom not found" for an id no chatroom has', () => {
    expect(panelView({ kind: 'room', roomId: OTHER_ID }, [room], [], false)).toEqual({
      kind: 'not-found',
    })
  })

  it('FR-4: shows "Chatroom not found" for a value that is not an id', () => {
    expect(panelView({ kind: 'invalid' }, undefined, [], false)).toEqual({ kind: 'not-found' })
  })

  it('FR-4: says the chatrooms could not be loaded instead of loading for ever', () => {
    expect(panelView({ kind: 'room', roomId: OTHER_ID }, undefined, [], true)).toEqual({
      kind: 'unavailable',
    })
  })

  it('still opens a chatroom the last successful list held when a refetch fails', () => {
    expect(panelView({ kind: 'room', roomId: room.id }, [room], [], true)).toEqual({
      kind: 'room',
      room,
    })
  })

  it('still shows a chatroom being created when the list cannot be loaded', () => {
    const creating = [{ id: OTHER_ID, lat: 1, lng: 2 }]

    expect(panelView({ kind: 'room', roomId: OTHER_ID }, undefined, creating, true)).toEqual({
      kind: 'creating',
      roomId: OTHER_ID,
    })
  })

  it("FR-3: keeps the mockup's invitation when nothing is selected", () => {
    expect(panelView({ kind: 'none' }, undefined, [], true)).toEqual({ kind: 'empty' })
  })
})

describe('roomsFailureText', () => {
  it('says the chatrooms could not be loaded when the list has never succeeded', () => {
    expect(roomsFailureText(false)).toBe(ROOMS_UNAVAILABLE)
  })

  it('says the list may be out of date when chatrooms are already on screen (M3 review)', () => {
    expect(roomsFailureText(true)).toBe(ROOMS_STALE)
  })
})
