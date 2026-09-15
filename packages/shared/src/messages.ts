import { z } from 'zod'

export const AUTHOR_MAX_LENGTH = 32
export const BODY_MAX_LENGTH = 1000
export const MESSAGES_PAGE_SIZE = 50

export const messageSchema = z.object({
  // Lowercased because Postgres returns UUIDs in lowercase: ids must compare equal as strings.
  id: z.uuid().toLowerCase(),
  roomId: z.uuid().toLowerCase(),
  author: z.string().min(1).max(AUTHOR_MAX_LENGTH),
  body: z.string().min(1).max(BODY_MAX_LENGTH),
  createdAt: z.iso.datetime({ precision: 3 }),
})
export type Message = z.infer<typeof messageSchema>

export const messageListSchema = z.array(messageSchema)

/** Postgres text columns cannot store NUL characters, so they are rejected up front. */
const hasNoNul = (value: string) => !value.includes('\u0000')

/** Body of `POST /api/rooms/:id/messages`. Values are trimmed before the length checks. */
export const createMessageInputSchema = z.object({
  id: z.uuid().toLowerCase(),
  author: z
    .string()
    .trim()
    .min(1, { error: 'Enter a user name' })
    .max(AUTHOR_MAX_LENGTH, { error: `User names are limited to ${AUTHOR_MAX_LENGTH} characters` })
    .refine(hasNoNul, { error: 'User names cannot contain NUL characters' }),
  body: z
    .string()
    .trim()
    .min(1, { error: 'Write a message' })
    .max(BODY_MAX_LENGTH, { error: `Messages are limited to ${BODY_MAX_LENGTH} characters` })
    .refine(hasNoNul, { error: 'Messages cannot contain NUL characters' }),
})
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>

/** Query of `GET /api/rooms/:id/messages`: the newest `limit` messages older than `before`. */
export const listMessagesQuerySchema = z.object({
  before: z.uuid().toLowerCase().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(MESSAGES_PAGE_SIZE),
})
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>

type Ordered = Pick<Message, 'createdAt' | 'id'>

/**
 * The one message order used everywhere: by `createdAt`, then by `id`. Timestamps always have
 * millisecond precision (see `messageSchema`), so string order is time order.
 */
export function compareMessages(a: Ordered, b: Ordered): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}
