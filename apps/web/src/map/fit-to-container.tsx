import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Leaflet only notices window resizes. Below 640 px the chat sheet grows and shrinks under the map,
 * so this tells Leaflet whenever its container changes size, keeping the centre in the middle.
 */
export function FitToContainer() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}
