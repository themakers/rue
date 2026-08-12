import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const targets = [packageJson.types, packageJson.module, packageJson.main]

for (const target of targets) await access(new URL(`../${target}`, import.meta.url))

const esm = await import(new URL('../dist/rue.js', import.meta.url))
const cjs = require('../dist/rue.cjs')
const requiredExports = [
  'baseWatch',
  'onMounted',
  'onUpdated',
  'onBeforeUnmount',
  'useRef',
  'useReactive',
  'useComputed',
  'useWatch',
  'useWatchEffect',
  'useEffectScope',
  'useReactivity',
]

for (const name of requiredExports) {
  if (!(name in esm) || !(name in cjs)) throw new Error(`Missing package export: ${name}`)
}

console.log(`ESM and CJS expose ${Object.keys(esm).length} exports.`)
