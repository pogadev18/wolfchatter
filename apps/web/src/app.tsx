import { type CreateRoomInput, type Room, roomTitle } from '@wolfchatter/shared'
import type { LatLngLiteral } from 'leaflet'
import { useState } from 'react'
import { describeFailure } from './api/client.ts'
import { wrapLongitude } from './map/longitude.ts'
import { MapView } from './map/map-view.tsx'
import type { RoomPin } from './map/room-pins.tsx'
import { ChatPanel } from './panel/chat-panel.tsx'
import type { PanelNotice } from './panel/notice.ts'
import { visibleNotice } from './panel/notice.ts'
import { panelView, roomsFailureText } from './panel/panel-view.ts'
import { useRealtime } from './realtime/use-realtime.ts'
import { useRoomSelection } from './rooms/use-room-selection.ts'
import { useCreateRoom, useRooms, useRoomsBeingCreated } from './rooms/use-rooms.ts'

/**
 * A full-screen map with the chat panel on top of it. Below 640 px the panel becomes a bottom
 * sheet under the map, so the map's attribution stays visible.
 */
export function App() {
  const rooms = useRooms()
  const creating = useRoomsBeingCreated()
  const { selection, selectRoom, deselectRoom } = useRoomSelection()
  const selectedRoomId = selection.kind === 'room' ? selection.roomId : undefined
  useRealtime(selectedRoomId)
  // The panel's one notice, wherever it came from. `setNotice` is stable, which is what lets
  // `RoomChat` clear it once per chatroom it opens instead of on every render.
  const [notice, setNotice] = useState<PanelNotice>()
  const createRoom = useCreateRoom({
    onError: (error, input) => {
      deselectRoom(input.id)
      setNotice({
        text: `Couldn't create the chatroom. ${describeFailure(error)}`,
        // Scopes the notice to the chatroom it is about (M3 review, requirement 5): shown while
        // that failure is still relevant, hidden once the user has moved on to another one.
        roomId: input.id,
        // Retries with the same id and position; the API's create is idempotent on id, so this
        // can never duplicate a chatroom the first, unseen attempt actually managed to store.
        retry: () => {
          setNotice(undefined)
          createRoom.mutate(input)
          selectRoom(input.id)
        },
      })
    },
  })

  function handleCreateRoom(position: LatLngLiteral) {
    const input = { id: crypto.randomUUID(), lat: position.lat, lng: wrapLongitude(position.lng) }
    setNotice(undefined)
    createRoom.mutate(input)
    selectRoom(input.id)
  }

  function handleSelectRoom(roomId: string) {
    setNotice(undefined)
    selectRoom(roomId)
  }

  return (
    <div className="flex h-dvh flex-col sm:block">
      <h1 className="sr-only">Wolfchatter</h1>
      {/* `isolate` keeps Leaflet's z-indexes inside the map, under the panel. */}
      <main className="relative isolate min-h-0 flex-1 sm:absolute sm:inset-0">
        <MapView
          pins={roomPins(rooms.data ?? [], creating)}
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={handleCreateRoom}
        />
        {/*
          The map alone would look empty rather than broken. Above Leaflet's controls (1000),
          right of the zoom buttons, and left of the floating panel on wide screens.
        */}
        {rooms.isError && (
          <p
            role="status"
            className="pointer-events-none absolute top-4 right-4 left-14 z-[1100] text-center sm:right-[26rem]"
          >
            <span className="inline-block rounded bg-white/90 px-3 py-1 text-red-700 text-sm shadow">
              {roomsFailureText(rooms.data !== undefined)}
            </span>
          </p>
        )}
      </main>
      <ChatPanel
        view={panelView(selection, rooms.data, creating, rooms.isError)}
        notice={visibleNotice(notice, selectedRoomId)}
        onNotice={setNotice}
      />
    </div>
  )
}

function roomPins(rooms: readonly Room[], creating: readonly CreateRoomInput[]): RoomPin[] {
  const confirmed = new Set(rooms.map(({ id }) => id))
  return [
    ...rooms.map((room) => ({ ...room, title: roomTitle(room), pending: false })),
    ...creating
      .filter(({ id }) => !confirmed.has(id))
      .map((input) => ({ ...input, title: 'Creating chatroom…', pending: true })),
  ]
}
