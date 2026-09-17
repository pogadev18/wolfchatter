import type { CreateMessageInput, Message } from '@wolfchatter/shared'
import { useEffect, useRef, useState } from 'react'
import { describeFailure } from '../api/client.ts'
import type { PanelNotice } from '../panel/notice.ts'
import { newestArrival } from './announcements.ts'
import { MessageForm } from './message-form.tsx'
import { MessageList } from './message-list.tsx'
import type { OutgoingMessage } from './outbox.ts'
import { unsentMessages } from './outbox.ts'
import { useMessages, useOutgoingMessages, useSendMessage } from './use-messages.ts'

interface RoomChatProps {
  roomId: string
  title: string
  /** The chatroom's create is still in flight. */
  creating: boolean
  /**
   * Reports the panel's one notice upward, as `MessageForm` reports a validation problem here.
   * Must stay referentially stable: the mount effect below depends on it.
   */
  onNotice(notice: PanelNotice | undefined): void
}

/** A chatroom's title, messages and form. The panel mounts one per chatroom, keyed by its id. */
export function RoomChat({ roomId, title, creating, onNotice }: RoomChatProps) {
  const messages = useMessages(roomId, { enabled: !creating })
  const outgoing = useOutgoingMessages(roomId)
  const { send, retry } = useSendMessage({
    onRejected: (error) =>
      onNotice({ text: `Your message was not sent. ${describeFailure(error)}` }),
  })
  const stored = messages.data ?? []
  const announcement = useArrivalAnnouncement(messages.data)

  // Mounting is a room change, because the panel keys this by chatroom id. That covers the paths
  // that change the selection without going through the panel: Back, Forward and the opening URL.
  useEffect(() => {
    onNotice(undefined)
  }, [onNotice])

  function handleSend(input: CreateMessageInput) {
    onNotice(undefined)
    announcement.sentByMe(input.id)
    send({ roomId, input })
  }

  /** Retrying is the user acting on the notice, so the notice goes with the attempt. */
  function handleRetry(message: OutgoingMessage) {
    onNotice(undefined)
    retry(message)
  }

  return (
    <>
      <h2 className="text-center font-semibold text-rose-700">{title}</h2>
      {messages.isError && (
        <p className="text-center text-red-700 text-sm">The messages could not be loaded.</p>
      )}
      <MessageList
        messages={stored}
        unsent={unsentMessages(outgoing, stored)}
        onRetry={handleRetry}
      />
      <MessageForm disabled={creating} onSend={handleSend} onProblem={onNotice} />
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
