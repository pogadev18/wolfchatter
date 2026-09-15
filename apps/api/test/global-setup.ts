import { randomUUID } from 'node:crypto'
import type { TestProject } from 'vitest/node'
import { connectDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { adminQuery, databaseUrl, testServerUrl } from './postgres.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: { serverUrl: string; template: string }
  }
}

/** Migrates a template database once per run; each test file copies it (see database.ts). */
export default async function setup(project: TestProject) {
  const serverUrl = testServerUrl()
  const template = `wolfchatter_template_${randomUUID().replaceAll('-', '')}`

  await adminQuery(serverUrl, `CREATE DATABASE ${template}`)
  const { db, pool } = connectDatabase(databaseUrl(serverUrl, template), (error) => {
    throw error
  })
  try {
    await migrateDatabase(db)
  } finally {
    await pool.end()
  }

  project.provide('postgres', { serverUrl, template })
  return () => adminQuery(serverUrl, `DROP DATABASE IF EXISTS ${template} WITH (FORCE)`)
}
