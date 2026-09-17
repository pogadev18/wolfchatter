import type { CreateRoomInput, Room } from '@wolfchatter/shared'
import type { RoomSelection } from '../rooms/selection.ts'

export type PanelView =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-found' }
  | { kind: 'creating'; roomId: string }
  | { kind: 'room'; room: Room }

/**
 * Said in the panel and over the map when the chatroom list has never loaded (`panelView`'s
 * `unavailable` case can only be reached in that state — see `roomsFailureText`).
 */
export const ROOMS_UNAVAILABLE = 'The chatrooms could not be loaded'

/**
 * Said over the map when chatrooms are already on screen and only a background refresh failed
 * (M3 review, requirement 3): they came from a real past success and are still good, just
 * possibly behind, which is a different fact from "missing" and reads as a softer failure.
 */
export const ROOMS_STALE = 'The chatroom list may be out of date'

/**
 * What the map's rooms-failure banner says. Fatal only if the list has never loaded even once;
 * `hasRooms` being true means some fetch already succeeded, so the pins on screen are real and
 * the same failure is merely a stale refresh, not a missing list.
 */
export function roomsFailureText(hasRooms: boolean): string {
  return hasRooms ? ROOMS_STALE : ROOMS_UNAVAILABLE
}

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
