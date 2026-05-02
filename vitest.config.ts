import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['.worktrees/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'src/node/index.ts',
        'src/parser/index.ts',
        'src/api/index.ts',
        'src/adapters/renderer/index.ts',
        'src/adapters/audio/index.ts',
        'src/adapters/import/**',
      ],
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 70,
        statements: 80,
      },
    },
  },
})
