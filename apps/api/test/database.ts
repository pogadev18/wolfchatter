import { randomUUID } from 'node:crypto'
import { inject } from 'vitest'
import { connectDatabase, type DatabaseConnection } from '../src/db/client.ts'
import { adminQuery, databaseUrl } from './postgres.ts'

export interface TestDatabase extends DatabaseConnection {
  url: string
  /** Closes the pool and drops the database. */
  drop(): Promise<void>
}

/** A fresh, migrated database of its own, copied from the run's template. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const { serverUrl, template } = inject('postgres')
  const name = `wolfchatter_test_${randomUUID().replaceAll('-', '')}`
  await adminQuery(serverUrl, `CREATE DATABASE ${name} TEMPLATE ${template}`)

  const url = databaseUrl(serverUrl, name)
  const connection = connectDatabase(url, (error) => {
    throw error
  })
  return {
    ...connection,
    url,
    async drop() {
      await connection.pool.end()
      await adminQuery(serverUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    },
  }
}
