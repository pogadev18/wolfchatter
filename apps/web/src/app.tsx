import { type CreateRoomInput, type Room, roomTitle } from '@wolfchatter/shared'
import type { LatLngLiteral } from 'leaflet'
import { useState } from 'react'
import { describeFailure } from './api/client.ts'
import { wrapLongitude } from './map/longitude.ts'
import { MapView } from './map/map-view.tsx'
import type { RoomPin } from './map/room-pins.tsx'
import { ChatPanel, ROOMS_UNAVAILABLE } from './panel/chat-panel.tsx'
import { panelView } from './panel/panel-view.ts'
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
  const [notice, setNotice] = useState<string>()
  const createRoom = useCreateRoom({
    onError: (error, input) => {
      deselectRoom(input.id)
      setNotice(`Couldn't create the chatroom. ${describeFailure(error)}`)
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
        {/* The map alone would look empty rather than broken. Above Leaflet's controls (1000). */}
        {rooms.isError && (
          <p className="pointer-events-none absolute inset-x-0 top-4 z-[1100] text-center">
            <span className="rounded bg-white/90 px-3 py-1 text-red-700 text-sm shadow">
              {ROOMS_UNAVAILABLE}
            </span>
          </p>
        )}
      </main>
      <ChatPanel
        view={panelView(selection, rooms.data, creating, rooms.isError)}
        notice={notice}
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
