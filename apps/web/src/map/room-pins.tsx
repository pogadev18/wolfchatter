import { divIcon } from 'leaflet'
import { useState } from 'react'
import { Marker, useMap, useMapEvents } from 'react-leaflet'
import { nearestWorldCopy } from './longitude.ts'

export interface RoomPin {
  id: string
  lat: number
  lng: number
  /** The pin's accessible name, such as "Chatroom 3". */
  title: string
  /** Its create is still in flight. */
  pending: boolean
}

const PIN_SVG =
  '<svg viewBox="0 0 30 42" width="30" height="42" aria-hidden="true"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="white"/></svg>'

function pinIcon(className: string) {
  return divIcon({ className, html: PIN_SVG, iconSize: [30, 42], iconAnchor: [15, 41] })
}

const PIN_ICONS = {
  default: pinIcon('room-pin text-sky-600'),
  selected: pinIcon('room-pin room-pin--selected text-rose-600'),
  pending: pinIcon('room-pin room-pin--pending text-sky-600 opacity-60'),
}

interface RoomPinsProps {
  pins: readonly RoomPin[]
  selectedRoomId: string | undefined
  onSelect(roomId: string): void
}

/** A pin per chatroom, drawn in the copy of the world the map is showing. */
export function RoomPins({ pins, selectedRoomId, onSelect }: RoomPinsProps) {
  const map = useMap()
  const [centerLng, setCenterLng] = useState(() => map.getCenter().lng)
  useMapEvents({ moveend: () => setCenterLng(map.getCenter().lng) })

  return pins.map((pin) => {
    const selected = pin.id === selectedRoomId
    const icon = pin.pending ? PIN_ICONS.pending : selected ? PIN_ICONS.selected : PIN_ICONS.default
    return (
      <Marker
        // A confirmed pin replaces its pending one: Leaflet reads a marker's title only once.
        key={pin.pending ? `pending-${pin.id}` : pin.id}
        position={[pin.lat, nearestWorldCopy(pin.lng, centerLng)]}
        icon={icon}
        title={pin.title}
        zIndexOffset={selected ? 1000 : 0}
        eventHandlers={{ click: () => onSelect(pin.id) }}
      />
    )
  })
}
