import type { CreateMessageInput, Message } from '@wolfchatter/shared'
import { useEffect, useRef, useState } from 'react'
import { describeFailure } from '../api/client.ts'
import { newestArrival } from './announcements.ts'
import { MessageForm } from './message-form.tsx'
import { MessageList } from './message-list.tsx'
import { unsentMessages } from './outbox.ts'
import { useMessages, useOutgoingMessages, useSendMessage } from './use-messages.ts'

interface RoomChatProps {
  roomId: string
  title: string
  /** The chatroom's create is still in flight. */
  creating: boolean
}

/** A chatroom's title, messages and form. The panel mounts one per chatroom, keyed by its id. */
export function RoomChat({ roomId, title, creating }: RoomChatProps) {
  const messages = useMessages(roomId, { enabled: !creating })
  const outgoing = useOutgoingMessages(roomId)
  // The panel's one notice: a client-side validation problem or a permanently rejected send.
  // A new one replaces a stale one, so at most one `role="alert"` is ever live at once.
  const [notice, setNotice] = useState<string>()
  const { send, retry } = useSendMessage({
    onRejected: (error) => setNotice(`Your message was not sent. ${describeFailure(error)}`),
  })
  const stored = messages.data ?? []
  const announcement = useArrivalAnnouncement(messages.data)

  function handleSend(input: CreateMessageInput) {
    setNotice(undefined)
    announcement.sentByMe(input.id)
    send({ roomId, input })
  }

  return (
    <>
      <h2 className="text-center font-semibold text-rose-700">{title}</h2>
      {messages.isError && (
        <p className="text-center text-red-700 text-sm">The messages could not be loaded.</p>
      )}
      <MessageList messages={stored} unsent={unsentMessages(outgoing, stored)} onRetry={retry} />
      <MessageForm disabled={creating} onSend={handleSend} onProblem={setNotice} />
      {notice && (
        <p role="alert" className="text-center text-red-700 text-sm">
          {notice}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement.text}
      </p>
    </>
  )
}

/**
 * What the polite live region reads out: the newest message that arrived after the chat first
 * loaded, unless this user sent it.
 */
function useArrivalAnnouncement(messages: readonly Message[] | undefined) {
  const shown = useRef<ReadonlySet<string>>(undefined)
  const mine = useRef(new Set<string>())
  const [text, setText] = useState('')

  useEffect(() => {
    if (!messages) return
    const before = shown.current
    shown.current = new Set(messages.map(({ id }) => id))
    if (!before) return
    const arrival = newestArrival(before, messages, mine.current)
    if (arrival) setText(`${arrival.author}: ${arrival.body}`)
  }, [messages])

  return { text, sentByMe: (id: string) => mine.current.add(id) }
}
