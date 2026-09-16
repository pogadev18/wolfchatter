import { useState } from 'react'
import { describeFailure } from '../api/client.ts'
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
  const [rejection, setRejection] = useState<string>()
  const { send, retry } = useSendMessage({
    onRejected: (error) => setRejection(`Your message was not sent. ${describeFailure(error)}`),
  })
  const stored = messages.data ?? []

  return (
    <>
      <h2 className="text-center font-semibold text-rose-700">{title}</h2>
      {messages.isError && (
        <p className="text-center text-red-700 text-sm">The messages could not be loaded.</p>
      )}
      <MessageList messages={stored} unsent={unsentMessages(outgoing, stored)} onRetry={retry} />
      <MessageForm
        disabled={creating}
        onSend={(input) => {
          setRejection(undefined)
          send({ roomId, input })
        }}
      />
      {rejection && (
        <p role="alert" className="text-center text-red-700 text-sm">
          {rejection}
        </p>
      )}
    </>
  )
}
