// `pnpm db:migrate`: applies pending migrations to DATABASE_URL.
import { parseEnv } from '../env.ts'
import { connectDatabase, NO_STATEMENT_TIMEOUT } from './client.ts'
import { migrateDatabase } from './migrations.ts'

const { DATABASE_URL } = parseEnv(process.env)
// Unlike request-serving traffic, a migration is deliberate, unattended and may legitimately run
// for minutes (an index build, a backfill on a large table); it is bounded by the deploy
// workflow's own timeout, not by connectDatabase's request-serving statement_timeout default.
const { db, pool } = connectDatabase(
  DATABASE_URL,
  (error) => console.error(error),
  NO_STATEMENT_TIMEOUT,
)

try {
  await migrateDatabase(db)
  console.log('✔ Migrations applied')
} finally {
  await pool.end()
}
