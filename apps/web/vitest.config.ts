import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // Playwright owns e2e/*.spec.ts.
    include: ['src/**/*.test.ts'],
  },
})
