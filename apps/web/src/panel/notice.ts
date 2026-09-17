/**
 * The panel's one notice (worklog/2026-09-16T0243-ruling-one-notice-at-a-time-in-the-chat-panel.md):
 * a message, and optionally a way to try the failed action again. A failed chatroom create needs
 * this because its pin is gone and clicking the map again cannot land on the exact same spot —
 * unlike a failed message, which stays in place with its own retry in the message list.
 */
export interface PanelNotice {
  text: string
  retry?: () => void
  /**
   * The chatroom this notice is about, if any. Showing it only makes sense while that chatroom
   * is still relevant: the failure itself normally clears the selection back to none (M3 review,
   * requirement 5), and the notice belongs there too — it only stops belonging once the user has
   * moved on to a different, healthy chatroom.
   */
  roomId?: string
}

/**
 * Hides a room-scoped notice once a *different* chatroom has been selected in the meantime — for
 * example, a failed create's notice arriving after the user already opened another chatroom.
 * A notice with no `roomId` is not scoped to any one chatroom and always shows.
 */
export function visibleNotice(
  notice: PanelNotice | undefined,
  selectedRoomId: string | undefined,
): PanelNotice | undefined {
  if (notice?.roomId === undefined) return notice
  const openedAnotherRoom = selectedRoomId !== undefined && selectedRoomId !== notice.roomId
  return openedAnotherRoom ? undefined : notice
}
