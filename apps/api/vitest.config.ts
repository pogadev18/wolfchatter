import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Room for a new database connection that Docker Desktop on macOS holds for about 5 seconds.
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
})
