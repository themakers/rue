import viteDts from 'vite-plugin-dts'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import packageJson from './package.json' with { type: 'json' }

const banner = `
/*!
 * ${packageJson.name} v${packageJson.version}
 * ${packageJson.homepage}
 *
 * Uses @vue/reactivity
 * https://github.com/vuejs/core/tree/main/packages/reactivity
 *
 * (c) 2021-present Surmon, Veact contributors, and Rue contributors.
 * Released under the ${packageJson.license} License.
 */
`

export default defineConfig({
  plugins: [viteReact(), viteDts({ bundleTypes: true, tsconfigPath: './tsconfig.lib.json' })],
  build: {
    target: 'es2017',
    lib: {
      entry: './src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'rue.js' : 'rue.cjs'),
    },
    rollupOptions: {
      external: ['react', '@vue/reactivity'],
      output: {
        banner: `\n${banner}\n`,
      },
    },
  },
})
