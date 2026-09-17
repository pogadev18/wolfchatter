import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { ROOM_PARAM, withRoomDeselected, withRoomSelected } from './room-params.ts'
import { parseRoomParam } from './selection.ts'

/** The selected chatroom, kept in the URL as `?room=<id>` so a link opens the same chatroom (FR-4). */
export function useRoomSelection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get(ROOM_PARAM)
  const selection = parseRoomParam(param)
  const roomId = selection.kind === 'room' ? selection.roomId : undefined

  // An id in capitals names the same chatroom: show the canonical, lowercase form.
  useEffect(() => {
    if (roomId !== undefined && param !== roomId) {
      setSearchParams((current) => withRoomSelected(current, roomId), { replace: true })
    }
  }, [param, roomId, setSearchParams])

  const selectRoom = useCallback(
    (id: string) => setSearchParams((current) => withRoomSelected(current, id)),
    [setSearchParams],
  )

  /** Clears the selection if it is still `id`: the user may have opened another chatroom since. */
  const deselectRoom = useCallback(
    (id: string) =>
      setSearchParams((current) => withRoomDeselected(current, id), { replace: true }),
    [setSearchParams],
  )

  return { selection, selectRoom, deselectRoom }
}
