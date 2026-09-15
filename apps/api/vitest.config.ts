import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Room for a slow new database connection, such as `localhost` taking 5 seconds to resolve.
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
})
