import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/maestro.esm.js', format: 'esm', sourcemap: true },
      { file: 'dist/maestro.cjs.js', format: 'cjs', sourcemap: true },
      { file: 'dist/maestro.umd.js', format: 'umd', name: 'Maestro', sourcemap: true }
    ],
    plugins: [typescript()]
  },
  {
    input: 'src/node/index.ts',
    output: [
      { file: 'dist/maestro.node.esm.js', format: 'esm', sourcemap: true }
    ],
    plugins: [typescript()]
  }
])
