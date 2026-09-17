import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { worklogPlugin } from './plugins/worklog.ts'
import { parseWebEnv } from './src/env.ts'

/** The API that `pnpm dev` starts (apps/api/.env.example). */
const DEV_API_URL = 'http://127.0.0.1:3000'

/** This file's own directory: ESM has no `__dirname`, and `loadEnv` needs one to find `.env*`. */
const WEB_DIR = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => {
  // The dev server knows where the local API runs; a build must be told where its API lives.
  if (command === 'serve') process.env.VITE_API_URL ??= DEV_API_URL
  // Vite only resolves .env files *after* this function runs, so checking process.env alone
  // can't see apps/web/.env.production — a build fails, confusingly, while a working file sits
  // right there. loadEnv reads the same files Vite itself will, merged with process.env — and
  // real environment variables still win over file values (verified against Vite's own source:
  // loadEnv fills `env` from the parsed files first, then overwrites every VITE_-prefixed key
  // from `process.env` right before returning), which is what the Playwright web server's own
  // VITE_API_URL relies on.
  parseWebEnv(loadEnv(mode, WEB_DIR, 'VITE_'))

  return {
    plugins: [react(), tailwindcss(), worklogPlugin()],
    build: {
      rolldownOptions: {
        output: {
          // Libraries change less often than the app, so browsers keep them cached across deploys.
          codeSplitting: {
            groups: [
              {
                name: 'leaflet',
                test: /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/,
                priority: 2,
              },
              { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
  }
})
