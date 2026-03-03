import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            thresholds: {
                statements: 95,
                branches: 95,
                functions: 100,
                lines: 95,
            },
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/async-entry.ts', 'src/computed-entry.ts'],
        },
        reporters: ['verbose'],
    },
})
