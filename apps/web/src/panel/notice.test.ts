import { describe, expect, it } from 'vitest'
import { type PanelNotice, visibleNotice } from './notice.ts'

const ROOM_A = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'
const ROOM_B = '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e'

describe('visibleNotice', () => {
  it('shows nothing when there is no notice', () => {
    expect(visibleNotice(undefined, ROOM_A)).toBeUndefined()
  })

  it('always shows a notice that is not scoped to a chatroom', () => {
    const notice: PanelNotice = { text: 'Enter a user name' }

    expect(visibleNotice(notice, ROOM_A)).toBe(notice)
    expect(visibleNotice(notice, undefined)).toBe(notice)
  })

  it('shows a room-scoped notice while its own chatroom is still selected', () => {
    const notice: PanelNotice = { text: "Couldn't create the chatroom.", roomId: ROOM_A }

    expect(visibleNotice(notice, ROOM_A)).toBe(notice)
  })

  it('shows a room-scoped notice once selection clears back to none, which is the failure’s own doing', () => {
    // deselectRoom only clears the selection if the failed chatroom was still open, so this is
    // the expected outcome of the very failure the notice reports — not a reason to hide it.
    const notice: PanelNotice = { text: "Couldn't create the chatroom.", roomId: ROOM_A }

    expect(visibleNotice(notice, undefined)).toBe(notice)
  })

  it('FR-2: hides a room-scoped notice once a different chatroom has been selected', () => {
    const notice: PanelNotice = { text: "Couldn't create the chatroom.", roomId: ROOM_A }

    expect(visibleNotice(notice, ROOM_B)).toBeUndefined()
  })
})
