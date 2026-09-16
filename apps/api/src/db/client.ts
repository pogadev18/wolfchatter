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
 * Opens a connection pool. `onIdleError` receives errors from idle connections, such as a
 * database restart or a serverless database suspending; without a listener they crash the process.
 * `statementTimeoutMs` defaults to `STATEMENT_TIMEOUT_MS`; a test may shorten it instead of
 * waiting out the production value.
 */
export function connectDatabase(
  url: string,
  onIdleError: (error: Error) => void,
  statementTimeoutMs: number = STATEMENT_TIMEOUT_MS,
): DatabaseConnection {
  // 10 seconds covers a serverless database waking up, and a host named `localhost`, which on
  // macOS sometimes takes 5 seconds to resolve.
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
    statement_timeout: statementTimeoutMs,
  })
  pool.on('error', onIdleError)
  return { db: drizzle({ client: pool }), pool }
}
