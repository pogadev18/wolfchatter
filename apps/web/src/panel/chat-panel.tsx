import { roomTitle } from '@wolfchatter/shared'
import { Link } from 'react-router'
import { RoomChat } from '../messages/room-chat.tsx'
import { useConnectionStatusText } from '../realtime/use-realtime.ts'
import type { PanelNotice } from './notice.ts'
import { type PanelView, ROOMS_UNAVAILABLE } from './panel-view.ts'

interface ChatPanelProps {
  view: PanelView
  /** Why the last action failed, such as a chatroom that could not be created. */
  notice: PanelNotice | undefined
  /** Set by the chat as well, so the whole panel has one notice and one `role="alert"`. */
  onNotice(notice: PanelNotice | undefined): void
}

/** The chat panel from the mockup: top-right on wide screens, a bottom sheet below 640 px. */
export function ChatPanel({ view, notice, onNotice }: ChatPanelProps) {
  const status = useConnectionStatusText()

  return (
    <aside
      aria-label="Chat"
      className="flex max-h-[50dvh] flex-col gap-3 border-stone-300 border-t bg-white p-4 shadow-lg sm:absolute sm:top-4 sm:right-4 sm:max-h-[calc(100dvh-5rem)] sm:w-96 sm:rounded-lg sm:border"
    >
      <PanelContent view={view} onNotice={onNotice} />
      {notice && (
        <p role="alert" className="text-center text-red-700 text-sm">
          {notice.text}
          {notice.retry && (
            <>
              {' '}
              <button type="button" onClick={notice.retry} className="font-semibold underline">
                Retry
              </button>
            </>
          )}
        </p>
      )}
      <p role="status" className="text-center text-stone-500 text-xs">
        {status}
      </p>
      {/* FR-8: a small, unobtrusive way to the devlog. Kept as its own line so it cannot collide
          with the notice/status logic above (M4-T5 rewrites that in this same file). */}
      <p className="text-center">
        <Link to="/devlog" className="text-stone-400 text-xs underline hover:text-stone-600">
          Devlog
        </Link>
      </p>
    </aside>
  )
}

function PanelContent({ view, onNotice }: Omit<ChatPanelProps, 'notice'>) {
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
      return (
        <RoomChat
          key={view.roomId}
          roomId={view.roomId}
          title="Creating chatroom…"
          creating
          onNotice={onNotice}
        />
      )
    case 'room':
      return (
        <RoomChat
          key={view.room.id}
          roomId={view.room.id}
          title={roomTitle(view.room)}
          creating={false}
          onNotice={onNotice}
        />
      )
  }
}
