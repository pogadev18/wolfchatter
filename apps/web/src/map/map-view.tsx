import type { LatLngTuple } from 'leaflet'
import { MapContainer } from 'react-leaflet'
import { BaseTiles, WATERCOLOR_TILES } from './base-tiles.tsx'

/** Cluj-Napoca at zoom 5, where the map opens (FR-1). */
const MAP_CENTER: LatLngTuple = [46.7712, 23.6236]
const MAP_ZOOM = 5

/** The full-screen map. Leaflet's defaults put the zoom controls top-left and attribution bottom-right. */
export function MapView() {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      maxZoom={WATERCOLOR_TILES.maxZoom}
      className="size-full"
    >
      <BaseTiles />
    </MapContainer>
  )
}
