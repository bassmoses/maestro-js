import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

export default defineConfig([
  {
    input: 'src/index.ts',
    external: ['vexflow', 'tone', 'jsdom', 'sharp', 'midi-writer-js'],
    output: [
      { file: 'dist/maestro.esm.js', format: 'esm', sourcemap: true, inlineDynamicImports: true },
      { file: 'dist/maestro.cjs.js', format: 'cjs', sourcemap: true, inlineDynamicImports: true },
      {
        file: 'dist/maestro.umd.js',
        format: 'umd',
        name: 'Maestro',
        sourcemap: true,
        globals: { vexflow: 'Vex', tone: 'Tone', 'midi-writer-js': 'MidiWriter' },
        inlineDynamicImports: true,
      },
    ],
    plugins: [typescript()],
  },
  {
    input: 'src/node/index.ts',
    external: ['vexflow', 'tone', 'jsdom', 'sharp', 'midi-writer-js'],
    output: [
      {
        file: 'dist/maestro.node.esm.js',
        format: 'esm',
        sourcemap: true,
        inlineDynamicImports: true,
      },
    ],
    plugins: [typescript()],
  },
])
