import type { CreateRoomInput, Room } from '@wolfchatter/shared'
import type { RoomSelection } from '../rooms/selection.ts'

export type PanelView =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-found' }
  | { kind: 'creating'; roomId: string }
  | { kind: 'room'; room: Room }

/** What the chat panel shows, given the selection, the chatrooms loaded so far and creates in flight. */
export function panelView(
  selection: RoomSelection,
  rooms: readonly Room[] | undefined,
  creating: readonly CreateRoomInput[],
  /** The chatroom list could not be loaded, so no id can be called unknown yet. */
  roomsFailed: boolean,
): PanelView {
  if (selection.kind === 'none') return { kind: 'empty' }
  if (selection.kind === 'invalid') return { kind: 'not-found' }

  const room = rooms?.find(({ id }) => id === selection.roomId)
  if (room) return { kind: 'room', room }
  if (creating.some(({ id }) => id === selection.roomId)) {
    return { kind: 'creating', roomId: selection.roomId }
  }
  // Without a list, a waiting panel would wait for ever; with one, its ids are the ones that exist.
  if (rooms) return { kind: 'not-found' }
  return roomsFailed ? { kind: 'unavailable' } : { kind: 'loading' }
}
