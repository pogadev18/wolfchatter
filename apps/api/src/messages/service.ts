import type { CreateMessageInput, ListMessagesQuery, Message } from '@wolfchatter/shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import pg from 'pg'
import type { Database } from '../db/client.ts'
import { messages, rooms } from '../db/schema.ts'
import { ApiError } from '../http/errors.ts'
import type { Publisher } from '../realtime/publisher.ts'

const FOREIGN_KEY_VIOLATION = '23503'

export interface MessagesService {
  /** The newest `limit` messages older than `before`, oldest first. */
  list(roomId: string, query: ListMessagesQuery): Promise<Message[]>
  create(roomId: string, input: CreateMessageInput): Promise<Message>
}

function toMessage(row: typeof messages.$inferSelect): Message {
  const { id, roomId, author, body, createdAt } = row
  return { id, roomId, author, body, createdAt: createdAt.toISOString() }
}

const roomNotFound = () => new ApiError(404, 'NOT_FOUND', 'Chatroom not found')

export function createMessagesService(db: Database, publisher: Publisher): MessagesService {
  return {
    async list(roomId, { before, limit }) {
      const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId))
      if (!room) throw roomNotFound()

      const cursor = before === undefined ? undefined : await findCursor(roomId, before)
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.roomId, roomId),
            cursor &&
              sql`(${messages.createdAt}, ${messages.id}) < (${cursor.createdAt}, ${cursor.id})`,
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit)
      return rows.reverse().map(toMessage)
    },

    /**
     * Inserts the message, or returns it unchanged when a retry sends the same id and content.
     * Like rooms, it is published either way.
     */
    async create(roomId, input) {
      const [inserted] = await db
        .insert(messages)
        .values({ ...input, roomId })
        .onConflictDoNothing({ target: messages.id })
        .returning()
        .catch((error: unknown) => {
          // The foreign key rejects unknown rooms without a separate, racy existence check.
          const cause = error instanceof Error ? error.cause : undefined
          const isMissingRoom =
            cause instanceof pg.DatabaseError && cause.code === FOREIGN_KEY_VIOLATION
          throw isMissingRoom ? roomNotFound() : error
        })
      const row = inserted ?? (await findRetriedMessage(roomId, input))
      const message = toMessage(row)
      publisher.messageCreated(message)
      return message
    },
  }

  async function findCursor(roomId: string, messageId: string) {
    const [cursor] = await db
      .select({ createdAt: messages.createdAt, id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.roomId, roomId)))
    if (!cursor) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'before must be a message in this chatroom')
    }
    return cursor
  }

  async function findRetriedMessage(roomId: string, input: CreateMessageInput) {
    const [existing] = await db.select().from(messages).where(eq(messages.id, input.id))
    const isRetry =
      existing?.roomId === roomId &&
      existing.author === input.author &&
      existing.body === input.body
    if (!existing || !isRetry) {
      throw new ApiError(409, 'CONFLICT', 'This message id is already used by another message')
    }
    return existing
  }
}
