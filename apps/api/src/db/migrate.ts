// `pnpm db:migrate`: applies pending migrations to DATABASE_URL.
import { parseEnv } from '../env.ts'
import { connectForMigrations, migrateDatabase } from './migrations.ts'

const { DATABASE_URL } = parseEnv(process.env)
// No statement timeout, and a bounded wait for locks: see connectForMigrations.
const { db, pool } = connectForMigrations(DATABASE_URL, (error) => console.error(error))

try {
  await migrateDatabase(db)
  console.log('✔ Migrations applied')
} finally {
  await pool.end()
}
