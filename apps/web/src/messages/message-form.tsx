import { type CreateMessageInput, createMessageInputSchema } from '@wolfchatter/shared'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { deviceStorage, loadUsername, saveUsername } from './username.ts'

interface MessageFormProps {
  /** True while the chatroom is still being created: the server has nowhere to store a message yet. */
  disabled: boolean
  onSend(input: CreateMessageInput): void
}

/** The mockup's inputs. Enter submits, and the shared contract checks the message before it is sent. */
export function MessageForm({ disabled, onSend }: MessageFormProps) {
  const authorId = useId()
  const bodyId = useId()
  const bodyRef = useRef<HTMLInputElement>(null)
  const [author, setAuthor] = useState(() => loadUsername(deviceStorage()))
  const [body, setBody] = useState('')
  const [problem, setProblem] = useState<string>()

  // FR-2, FR-4: opening a chatroom puts the cursor in the message input.
  useEffect(() => {
    bodyRef.current?.focus()
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const parsed = createMessageInputSchema.safeParse({ id: crypto.randomUUID(), author, body })
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message)
      return
    }
    setProblem(undefined)
    setBody('')
    onSend(parsed.data)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={authorId} className="sr-only">
        User name
      </label>
      <input
        id={authorId}
        value={author}
        onChange={(event) => {
          setAuthor(event.target.value)
          saveUsername(deviceStorage(), event.target.value)
        }}
        placeholder="write your user name here"
        autoComplete="nickname"
        className="rounded border border-stone-400 px-2 py-1"
      />
      <div className="flex gap-2">
        <label htmlFor={bodyId} className="sr-only">
          Message
        </label>
        <input
          id={bodyId}
          ref={bodyRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="write message here"
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-stone-400 px-2 py-1"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded border-2 border-stone-800 px-3 py-1 font-semibold disabled:opacity-50"
        >
          Submit
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-red-700 text-sm">
          {problem}
        </p>
      )}
    </form>
  )
}
