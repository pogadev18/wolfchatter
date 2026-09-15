import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'

export type Database = NodePgDatabase

export interface DatabaseConnection {
  db: Database
  pool: pg.Pool
}

/**
 * Opens a connection pool. `onIdleError` receives errors from idle connections, such as a
 * database restart or a serverless database suspending; without a listener they crash the process.
 */
export function connectDatabase(
  url: string,
  onIdleError: (error: Error) => void,
): DatabaseConnection {
  // 10 seconds covers a serverless database waking up, and Docker Desktop on macOS, whose port
  // forwarding sometimes holds a new connection for about 5 seconds.
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 10_000 })
  pool.on('error', onIdleError)
  return { db: drizzle({ client: pool }), pool }
}
