import type { LatLngLiteral, LatLngTuple } from 'leaflet'
import { MapContainer } from 'react-leaflet'
import { BaseTiles, WATERCOLOR_TILES } from './base-tiles.tsx'
import { FitToContainer } from './fit-to-container.tsx'
import { MapClicks } from './map-clicks.tsx'
import { type RoomPin, RoomPins } from './room-pins.tsx'

/** Cluj-Napoca at zoom 5, where the map opens (FR-1). */
const MAP_CENTER: LatLngTuple = [46.7712, 23.6236]
const MAP_ZOOM = 5

interface MapViewProps {
  pins: readonly RoomPin[]
  selectedRoomId: string | undefined
  onSelectRoom(roomId: string): void
  onCreateRoom(position: LatLngLiteral): void
}

/** The full-screen map. Leaflet's defaults put the zoom controls top-left and attribution bottom-right. */
export function MapView({ pins, selectedRoomId, onSelectRoom, onCreateRoom }: MapViewProps) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      maxZoom={WATERCOLOR_TILES.maxZoom}
      className="size-full"
    >
      <BaseTiles />
      <FitToContainer />
      <MapClicks onSingleClick={onCreateRoom} />
      <RoomPins pins={pins} selectedRoomId={selectedRoomId} onSelect={onSelectRoom} />
    </MapContainer>
  )
}
