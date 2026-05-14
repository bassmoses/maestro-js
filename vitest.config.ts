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
        'src/adapters/renderer/VexFlowAdapter.ts', // VexFlow DOM-dependent
        'src/adapters/renderer/modifiers.ts', // VexFlow DOM-dependent
        'src/adapters/renderer/spanners.ts', // VexFlow DOM-dependent
        'src/adapters/renderer/jsdom-utils.ts', // VexFlow DOM-dependent
        'src/adapters/renderer/render-note.ts', // VexFlow DOM-dependent
        'src/adapters/renderer/vex-maps.ts', // VexFlow DOM-dependent
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
