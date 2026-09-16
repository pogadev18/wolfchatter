import type { Message } from '@wolfchatter/shared'
import { type ReactNode, useEffect, useRef } from 'react'
import type { OutgoingMessage } from './outbox.ts'

/** Dates and times in the viewer's locale and time zone. */
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' })

interface MessageListProps {
  messages: readonly Message[]
  unsent: readonly OutgoingMessage[]
  onRetry(message: OutgoingMessage): void
}

/** Stored messages, oldest first, then the user's own messages that are not stored yet. */
export function MessageList({ messages, unsent, onRetry }: MessageListProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const count = messages.length + unsent.length

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current
    if (list && count > 0) list.scrollTop = list.scrollHeight
  }, [count])

  if (count === 0) {
    return <p className="py-6 text-center text-sm text-stone-500">No messages yet</p>
  }

  /* `tabIndex` puts the scrolling list in the tab order. Without it a keyboard-only user cannot
     reach the list, and so cannot read the history once it overflows: WCAG 2.1.1, and the axe
     rule scrollable-region-focusable. Biome's rule is about elements that do not scroll. */
  return (
    <ol
      ref={listRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region has to be focusable
      tabIndex={0}
      aria-label="Messages"
      className="min-h-0 flex-1 overflow-y-auto pr-1"
    >
      {messages.map((message) => (
        <MessageItem key={message.id} author={message.author} body={message.body}>
          <time dateTime={message.createdAt}>{dateTime.format(new Date(message.createdAt))}</time>
        </MessageItem>
      ))}
      {unsent.map((message) => (
        <MessageItem key={message.input.id} author={message.input.author} body={message.input.body}>
          {message.status === 'sending' ? (
            'Sending…'
          ) : (
            <span className="text-red-700">
              Not sent{' '}
              <button
                type="button"
                onClick={() => onRetry(message)}
                className="font-semibold underline"
              >
                Retry
              </button>
            </span>
          )}
        </MessageItem>
      ))}
    </ol>
  )
}

interface MessageItemProps {
  author: string
  body: string
  children: ReactNode
}

/** One message, laid out as in the mockup. React renders the text as text, never as HTML. */
function MessageItem({ author, body, children }: MessageItemProps) {
  return (
    <li className="border-stone-200 border-b py-2">
      <p className="flex gap-2">
        <span className="shrink-0 text-stone-600">{author}:</span>
        <span className="min-w-0 whitespace-pre-wrap break-words font-semibold">{body}</span>
      </p>
      <p className="text-right text-stone-500 text-xs">{children}</p>
    </li>
  )
}
