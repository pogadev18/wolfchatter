import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { parseEnv } from '../src/env.ts'

/**
 * The Postgres server the tests use: DATABASE_URL from the environment (CI), else from
 * apps/api/.env, else from apps/api/.env.example, the same order `pnpm dev` uses.
 */
export function testServerUrl(): string {
  for (const file of ['../.env', '../.env.example']) {
    const path = fileURLToPath(new URL(file, import.meta.url))
    if (existsSync(path)) process.loadEnvFile(path)
  }
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
