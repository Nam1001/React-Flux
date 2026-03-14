import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 100,
        lines: 95,
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/types.ts'],
    },
  },
})


