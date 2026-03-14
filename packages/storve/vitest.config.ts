import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environmentMatchGlobs: [
            ['**/tests/persist/adapters/**', 'jsdom']
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            thresholds: {
                statements: 85,
                branches: 85,   
                functions: 85,
                lines: 85,
            },
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/async-entry.ts', 'src/computed-entry.ts'],
        },
        reporters: ['verbose'],
    },
})
