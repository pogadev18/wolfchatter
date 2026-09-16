/**
 * Where the end-to-end run serves the API and the web app. The ports and database differ from
 * `pnpm dev`'s (3000, 5173, `wolfchatter`), so the tests never touch development data.
 */
export const API_PORT = 3100
export const WEB_PORT = 4173
export const API_URL = `http://127.0.0.1:${API_PORT}`
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`

/** The local Postgres from compose.yaml, which CI runs as a service on the same port. */
export const POSTGRES_URL = 'postgres://wolfchatter:wolfchatter@127.0.0.1:5433/wolfchatter'
export const E2E_DATABASE = 'wolfchatter_e2e'
export const E2E_DATABASE_URL = `postgres://wolfchatter:wolfchatter@127.0.0.1:5433/${E2E_DATABASE}`
