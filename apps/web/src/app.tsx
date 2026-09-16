import { MapView } from './map/map-view.tsx'
import { ChatPanel } from './panel/chat-panel.tsx'

/**
 * A full-screen map with the chat panel on top of it. Below 640 px the panel becomes a bottom
 * sheet under the map, so the map's attribution stays visible.
 */
export function App() {
  return (
    <div className="flex h-dvh flex-col sm:block">
      {/* `isolate` keeps Leaflet's z-indexes inside the map, under the panel. */}
      <main className="relative isolate min-h-0 flex-1 sm:absolute sm:inset-0">
        <MapView />
      </main>
      <ChatPanel />
    </div>
  )
}
