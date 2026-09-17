export const ROOM_PARAM = 'room'

/** Sets `?room=id`, keeping every other query parameter as it was (M3 review, requirement 6). */
export function withRoomSelected(current: URLSearchParams, id: string): URLSearchParams {
  const next = new URLSearchParams(current)
  next.set(ROOM_PARAM, id)
  return next
}

/**
 * Clears `?room=` only if it still names `id` — the caller may have selected another chatroom
 * since — keeping every other query parameter as it was (M3 review, requirement 6).
 */
export function withRoomDeselected(current: URLSearchParams, id: string): URLSearchParams {
  if (current.get(ROOM_PARAM) !== id) return current
  const next = new URLSearchParams(current)
  next.delete(ROOM_PARAM)
  return next
}
