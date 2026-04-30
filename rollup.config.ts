import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import { defineConfig } from 'rollup'

export default defineConfig([
  // --- ESM + CJS (externals preserved for bundler consumers) ---
  {
    input: 'src/index.ts',
    external: ['vexflow', 'tone', 'jsdom', 'sharp', 'midi-writer-js'],
    output: [
      { file: 'dist/maestro.esm.js', format: 'esm', sourcemap: true, inlineDynamicImports: true },
      { file: 'dist/maestro.cjs.js', format: 'cjs', sourcemap: true, inlineDynamicImports: true },
    ],
    plugins: [typescript()],
  },

  // --- Standalone UMD (all browser deps bundled — single <script> tag) ---
  {
    input: 'src/index.ts',
    // Only exclude Node-only packages; bundle vexflow + tone + midi-writer-js
    external: ['jsdom', 'sharp'],
    output: [
      {
        file: 'dist/maestro.umd.js',
        format: 'umd',
        name: 'Maestro',
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: 'dist/maestro.umd.min.js',
        format: 'umd',
        name: 'Maestro',
        sourcemap: true,
        inlineDynamicImports: true,
        plugins: [terser()],
      },
    ],
    plugins: [resolve({ browser: true, preferBuiltins: false }), commonjs(), json(), typescript()],
  },

  // --- Node ESM entry ---
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
