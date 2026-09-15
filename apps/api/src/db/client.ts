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
  // 10 seconds covers a serverless database waking up, and a host named `localhost`, which on
  // macOS sometimes takes 5 seconds to resolve.
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 10_000 })
  pool.on('error', onIdleError)
  return { db: drizzle({ client: pool }), pool }
}
