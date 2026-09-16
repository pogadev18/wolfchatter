// Recreates the end-to-end database, empty, before the API migrates it and starts. It runs as
// part of the API's webServer command because Playwright starts web servers before globalSetup.
import pg from 'pg'
import { E2E_DATABASE, POSTGRES_URL } from './environment.ts'

const client = new pg.Client({ connectionString: POSTGRES_URL })
try {
  await client.connect()
} catch (error) {
  throw new Error('Postgres is not reachable on 127.0.0.1:5433. Start it with `pnpm db:up`.', {
    cause: error,
  })
}
try {
  await client.query(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`)
  await client.query(`CREATE DATABASE ${E2E_DATABASE}`)
} finally {
  await client.end()
}
