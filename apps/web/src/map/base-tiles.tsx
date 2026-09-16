import { useState } from 'react'
import { TileLayer } from 'react-leaflet'

/** Stamen Watercolor from Stadia Maps. Localhost needs no key; a deployed domain must be registered. */
export const WATERCOLOR_TILES = {
  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
  attribution:
    '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  maxZoom: 16,
}

const OPENSTREETMAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  maxZoom: 19,
}

/** Watercolor tiles, replaced by OpenStreetMap for the rest of the visit once one fails (FR-1). */
export function BaseTiles() {
  const [watercolorFailed, setWatercolorFailed] = useState(false)

  if (watercolorFailed) return <TileLayer key="openstreetmap" {...OPENSTREETMAP_TILES} />
  return (
    <TileLayer
      key="watercolor"
      {...WATERCOLOR_TILES}
      eventHandlers={{ tileerror: () => setWatercolorFailed(true) }}
    />
  )
}
