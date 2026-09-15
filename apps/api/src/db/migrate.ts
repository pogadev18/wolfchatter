// `pnpm db:migrate`: applies pending migrations to DATABASE_URL.
import { parseEnv } from '../env.ts'
import { connectDatabase } from './client.ts'
import { migrateDatabase } from './migrations.ts'

const { DATABASE_URL } = parseEnv(process.env)
const { db, pool } = connectDatabase(DATABASE_URL, (error) => console.error(error))

try {
  await migrateDatabase(db)
  console.log('✔ Migrations applied')
} finally {
  await pool.end()
}
