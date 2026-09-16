import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { parseWebEnv } from './src/env.ts'

/** The API that `pnpm dev` starts (apps/api/.env.example). */
const DEV_API_URL = 'http://127.0.0.1:3000'

export default defineConfig(({ command }) => {
  // The dev server knows where the local API runs; a build must be told where its API lives.
  if (command === 'serve') process.env.VITE_API_URL ??= DEV_API_URL
  parseWebEnv(process.env)

  return {
    plugins: [react(), tailwindcss()],
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
