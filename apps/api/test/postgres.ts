import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { parseEnv } from '../src/env.ts'

/**
 * Loads `<dir>/.env.example` into `process.env`, for any variable not already set there.
 *
 * `.env` is deliberately never read: a developer's local override (a different database,
 * different rate limits) must never leak into the test run, or a test could pass or fail for
 * reasons that are not in the repository. `process.loadEnvFile` never replaces a variable already
 * present in `process.env`, so a value the real environment already set (CI's DATABASE_URL)
 * still wins over the file.
 */
export function loadEnvExample(dir: string): void {
  const path = join(dir, '.env.example')
  if (existsSync(path)) process.loadEnvFile(path)
}

/**
 * The Postgres server the tests use: DATABASE_URL from the real environment (CI sets it), else
 * from apps/api/.env.example. Never apps/api/.env — see loadEnvExample.
 */
export function testServerUrl(): string {
  loadEnvExample(fileURLToPath(new URL('..', import.meta.url)))
  return parseEnv(process.env).DATABASE_URL
}

/** The same server URL, pointing at another database. */
export function databaseUrl(serverUrl: string, database: string): string {
  const url = new URL(serverUrl)
  url.pathname = `/${database}`
  return url.toString()
}

/** Runs one admin statement, such as CREATE DATABASE, on its own connection. */
export async function adminQuery(serverUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: serverUrl })
  try {
    await client.connect()
  } catch (error) {
    const { hostname, port } = new URL(serverUrl)
    const hint = `Postgres is not reachable at ${hostname}:${port}. Start it with \`pnpm db:up\`.`
    throw new Error(hint, { cause: error })
  }
  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}
