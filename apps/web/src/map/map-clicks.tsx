import type { LatLngLiteral } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useMapEvents } from 'react-leaflet'
import { createSingleClickDetector } from './single-click.ts'

/**
 * Calls `onSingleClick` with the position of a single click on the map itself. Double-clicks
 * zoom instead, and drags fire no `click` at all; clicks on pins never reach the map.
 */
export function MapClicks({ onSingleClick }: { onSingleClick(position: LatLngLiteral): void }) {
  const latest = useRef(onSingleClick)
  useEffect(() => {
    latest.current = onSingleClick
  })
  const [detector] = useState(() =>
    createSingleClickDetector<LatLngLiteral>((position) => latest.current(position)),
  )
  useEffect(() => () => detector.cancel(), [detector])

  useMapEvents({
    click: ({ latlng, originalEvent }) =>
      detector.click({ lat: latlng.lat, lng: latlng.lng }, originalEvent.detail),
    dblclick: () => detector.cancel(),
  })
  return null
}
