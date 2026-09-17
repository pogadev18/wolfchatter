import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'

export type Database = NodePgDatabase

export interface DatabaseConnection {
  db: Database
  pool: pg.Pool
}

/**
 * Cancels a query that runs longer than this, so a slow or stuck statement cannot hold a pooled
 * connection forever. 5 seconds is far above any query this API makes and far below how long
 * anyone would wait for a response. Postgres reports a cancelled statement as error `57014`
 * (query_canceled).
 */
export const STATEMENT_TIMEOUT_MS = 5_000

/**
 * For a caller with no per-statement bound of its own to honour — a deliberate, unattended
 * one-off script such as a migration, which may legitimately run for minutes (an index build, a
 * backfill) and is bounded by its own deploy-workflow timeout instead. `pg` only sends
 * `statement_timeout` to Postgres when the value is truthy, so 0 leaves the connection at
 * Postgres's own server-side default rather than this pool's request-serving one.
 */
export const NO_STATEMENT_TIMEOUT = 0

export interface ConnectionTimeouts {
  /**
   * Defaults to `STATEMENT_TIMEOUT_MS`, chosen for request-serving traffic: far above any query
   * this API's routes make, far below how long anyone would wait for a response. That reasoning
   * does not transfer to every caller — a test may shorten it instead of waiting out the real
   * value, and a migration should raise or disable it (`NO_STATEMENT_TIMEOUT`) instead of
   * inheriting a bound sized for requests.
   */
  statementTimeoutMs?: number
  /**
   * How long a statement may wait for a lock before Postgres cancels it with `55P03`
   * (lock_not_available). Unset leaves Postgres's own default, which is no limit; migrations set
   * one (`MIGRATION_LOCK_TIMEOUT_MS` in `migrations.ts` says why).
   */
  lockTimeoutMs?: number
}

/**
 * Opens a connection pool. `onIdleError` receives errors from idle connections, such as a
 * database restart or a serverless database suspending; without a listener they crash the process.
 */
export function connectDatabase(
  url: string,
  onIdleError: (error: Error) => void,
  { statementTimeoutMs = STATEMENT_TIMEOUT_MS, lockTimeoutMs }: ConnectionTimeouts = {},
): DatabaseConnection {
  // 10 seconds covers a serverless database waking up, and a host named `localhost`, which on
  // macOS sometimes takes 5 seconds to resolve.
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
    statement_timeout: statementTimeoutMs,
    lock_timeout: lockTimeoutMs,
  })
  pool.on('error', onIdleError)
  return { db: drizzle({ client: pool }), pool }
}
