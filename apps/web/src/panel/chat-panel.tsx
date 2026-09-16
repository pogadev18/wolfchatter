import { roomTitle } from '@wolfchatter/shared'
import { RoomChat } from '../messages/room-chat.tsx'
import { useConnectionStatusText } from '../realtime/use-realtime.ts'
import type { PanelView } from './panel-view.ts'

/** Said in the panel and over the map, so a failed chatroom list is never silent. */
export const ROOMS_UNAVAILABLE = 'The chatrooms could not be loaded'

interface ChatPanelProps {
  view: PanelView
  /** Why the last action failed, such as a chatroom that could not be created. */
  notice: string | undefined
}

/** The chat panel from the mockup: top-right on wide screens, a bottom sheet below 640 px. */
export function ChatPanel({ view, notice }: ChatPanelProps) {
  const status = useConnectionStatusText()

  return (
    <aside
      aria-label="Chat"
      className="flex max-h-[50dvh] flex-col gap-3 border-stone-300 border-t bg-white p-4 shadow-lg sm:absolute sm:top-4 sm:right-4 sm:max-h-[calc(100dvh-5rem)] sm:w-96 sm:rounded-lg sm:border"
    >
      <PanelContent view={view} />
      {notice && (
        <p role="alert" className="text-center text-red-700 text-sm">
          {notice}
        </p>
      )}
      <p role="status" className="text-center text-stone-500 text-xs">
        {status}
      </p>
    </aside>
  )
}

function PanelContent({ view }: { view: PanelView }) {
  switch (view.kind) {
    case 'empty':
      return <p className="text-center text-stone-700">Click on the map to start a chat</p>
    case 'loading':
      return <p className="text-center text-stone-500">Loading chatroom…</p>
    case 'unavailable':
      return <p className="text-center text-red-700">{ROOMS_UNAVAILABLE}</p>
    case 'not-found':
      return <p className="text-center text-stone-700">Chatroom not found</p>
    case 'creating':
      return <RoomChat key={view.roomId} roomId={view.roomId} title="Creating chatroom…" creating />
    case 'room':
      return (
        <RoomChat
          key={view.room.id}
          roomId={view.room.id}
          title={roomTitle(view.room)}
          creating={false}
        />
      )
  }
}
