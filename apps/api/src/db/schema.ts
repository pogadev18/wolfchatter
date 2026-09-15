import { AUTHOR_MAX_LENGTH, BODY_MAX_LENGTH } from '@wolfchatter/shared'
import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/** Millisecond precision, so database order matches the contract's string order. */
const createdAt = () =>
  timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow()

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey(),
    number: integer('number').generatedAlwaysAsIdentity().unique(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check('rooms_lat_range', sql`${table.lat} BETWEEN -90 AND 90`),
    check('rooms_lng_range', sql`${table.lng} BETWEEN -180 AND 180`),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    author: varchar('author', { length: AUTHOR_MAX_LENGTH }).notNull(),
    body: varchar('body', { length: BODY_MAX_LENGTH }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('messages_room_created_at_id_idx').on(table.roomId, table.createdAt, table.id)],
)
