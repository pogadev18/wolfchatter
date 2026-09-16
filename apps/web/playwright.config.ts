import { defineConfig, devices } from '@playwright/test'
import { API_PORT, API_URL, E2E_DATABASE_URL, WEB_PORT, WEB_URL } from './e2e/environment.ts'

export default defineConfig({
  testDir: './e2e',
  // Tests share one database and empty it before each test, so they run one at a time.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    // Everything the tests click or type into appears at once; a missing element fails fast.
    actionTimeout: 5_000,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      // Plain node, not pnpm scripts: no apps/api/.env overrides, and SIGTERM reaches the server.
      command:
        'node e2e/prepare-database.ts && node ../api/src/db/migrate.ts && node ../api/src/server.ts',
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        CORS_ORIGINS: WEB_URL,
        TRUST_PROXY: '',
        // Every test shares 127.0.0.1 and the whole run fits in one window, so the PRD's 10
        // creates a minute would 429 a later test. The limits themselves are tested in apps/api.
        RATE_LIMIT_ROOMS_PER_MINUTE: '1000',
        RATE_LIMIT_MESSAGES_PER_MINUTE: '1000',
        LOG_LEVEL: 'warn',
      },
      url: `${API_URL}/api/health`,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'web',
      // The production build, as it will be deployed, pointed at the test API.
      command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { VITE_API_URL: API_URL },
      url: WEB_URL,
    },
  ],
})
