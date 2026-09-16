import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import {
  connectDatabase,
  type Database,
  type DatabaseConnection,
  NO_STATEMENT_TIMEOUT,
} from './client.ts'

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

/**
 * How long a migration statement may wait for a lock before failing with Postgres `55P03`.
 *
 * A migration waiting for a lock does not wait alone. Postgres queues every later request for a
 * lock that conflicts with the one it waits for, so while an `ALTER TABLE rooms` waits on some
 * other transaction, even a plain `SELECT` from `rooms` by the live API queues behind the `ALTER`.
 * Observed against local Postgres: with a transaction holding a read lock on the table, that
 * `SELECT` finished only once the waiting `ALTER` gave up. With no bound, the running API stalls
 * until whatever holds the lock lets go, or the deploy job times out.
 *
 * 2 seconds is long enough for any lock an ordinary request holds to clear: this API runs each
 * query as a single statement, outside any explicit transaction, and they finish in milliseconds,
 * so a lock still held after 2 seconds belongs to something abnormal, and the migration failing
 * loudly is the right outcome. It is short enough that requests queued behind the migration pause
 * for at most 2 seconds before it gives up and lets them through, well inside the web client's
 * 30-second request deadline: slowed, not failed. Pending migrations run in one transaction, so a
 * migration that gives up applies none of them, and the deploy workflow stops before it deploys
 * the API.
 */
export const MIGRATION_LOCK_TIMEOUT_MS = 2_000

/**
 * A connection for applying migrations. Unlike request-serving traffic, a migration is
 * deliberate, unattended and may legitimately run for minutes (an index build, a backfill on a
 * large table), so it has no statement timeout: it is bounded by the deploy workflow's own timeout
 * instead. What it must not do is wait unboundedly for a lock (`MIGRATION_LOCK_TIMEOUT_MS`).
 */
export function connectForMigrations(
  url: string,
  onIdleError: (error: Error) => void,
): DatabaseConnection {
  return connectDatabase(url, onIdleError, {
    statementTimeoutMs: NO_STATEMENT_TIMEOUT,
    lockTimeoutMs: MIGRATION_LOCK_TIMEOUT_MS,
  })
}

/** Applies the SQL migrations in `apps/api/drizzle` that have not run yet. */
export function migrateDatabase(db: Database): Promise<void> {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
