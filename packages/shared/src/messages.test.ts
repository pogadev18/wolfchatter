import { describe, expect, it } from 'vitest'
import {
  AUTHOR_MAX_LENGTH,
  BODY_MAX_LENGTH,
  compareMessages,
  createMessageInputSchema,
  listMessagesQuerySchema,
  messageSchema,
} from './messages.ts'

const id = '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e'
const roomId = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'

describe('createMessageInputSchema', () => {
  it('FR-5: trims the author and body', () => {
    expect(createMessageInputSchema.parse({ id, author: '  ana  ', body: '\n hello \t' })).toEqual({
      id,
      author: 'ana',
      body: 'hello',
    })
  })

  it('FR-5: rejects a blank author with a readable message', () => {
    const result = createMessageInputSchema.safeParse({ id, author: '   ', body: 'hello' })
    expect(result.error?.issues[0]?.message).toBe('Enter a user name')
  })

  it('FR-5: rejects a blank message with a readable message', () => {
    const result = createMessageInputSchema.safeParse({ id, author: 'ana', body: '   ' })
    expect(result.error?.issues[0]?.message).toBe('Write a message')
  })

  it('FR-5: applies the length limits after trimming', () => {
    const longestAuthor = 'a'.repeat(AUTHOR_MAX_LENGTH)
    const longestBody = 'b'.repeat(BODY_MAX_LENGTH)
    const parse = (author: string, body: string) =>
      createMessageInputSchema.safeParse({ id, author, body }).success

    expect(parse(` ${longestAuthor} `, longestBody)).toBe(true)
    expect(parse(`${longestAuthor}a`, 'hello')).toBe(false)
    expect(parse('ana', `${longestBody}b`)).toBe(false)
  })

  it('requires a UUID so retried requests can be deduplicated', () => {
    expect(
      createMessageInputSchema.safeParse({ id: '42', author: 'ana', body: 'hi' }).success,
    ).toBe(false)
  })
})

describe('messageSchema', () => {
  it('accepts a message as the API serialises it', () => {
    const message = {
      id,
      roomId,
      author: 'ana',
      body: 'hello',
      createdAt: '2026-09-15T10:00:00.000Z',
    }
    expect(messageSchema.parse(message)).toEqual(message)
  })
})

describe('listMessagesQuerySchema', () => {
  it('defaults to a page of 50 messages', () => {
    expect(listMessagesQuerySchema.parse({})).toEqual({ limit: 50 })
  })

  it('coerces query-string values', () => {
    expect(listMessagesQuerySchema.parse({ before: id, limit: '20' })).toEqual({
      before: id,
      limit: 20,
    })
  })

  it.each(['0', '101', '2.5', 'abc'])('rejects limit=%s', (limit) => {
    expect(listMessagesQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  it('rejects a cursor that is not a message id', () => {
    expect(listMessagesQuerySchema.safeParse({ before: 'yesterday' }).success).toBe(false)
  })
})

describe('compareMessages', () => {
  it('orders by createdAt, then by id', () => {
    const first = {
      id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
      createdAt: '2026-09-15T10:00:00.000Z',
    }
    const second = {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2026-09-15T10:00:01.000Z',
    }
    const third = {
      id: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-09-15T10:00:01.000Z',
    }

    expect([third, first, second].sort(compareMessages)).toEqual([first, second, third])
    expect(compareMessages(second, second)).toBe(0)
  })
})
