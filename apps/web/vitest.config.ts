import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    // Playwright owns e2e/*.spec.ts; plugins/ holds the build-time Vite plugin's own logic.
    include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
})
