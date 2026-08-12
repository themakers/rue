import { access, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { build } from 'esbuild'

const root = new URL('..', import.meta.url).pathname
const executable = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc'
const platformDirectory =
  process.platform === 'darwin' ? 'osx-bin' : process.platform === 'win32' ? 'win64-bin' : 'linux64-bin'
const hermes = join(root, 'node_modules', 'hermes-compiler', 'hermesc', platformDirectory, executable)
const cache = join(root, '.cache')
const bundle = join(cache, 'hermes-smoke.js')
const bytecode = join(cache, 'hermes-smoke.hbc')

await access(hermes)
await mkdir(cache, { recursive: true })
await build({
  bundle: true,
  entryPoints: [join(root, 'tests-hermes', 'smoke.ts')],
  format: 'iife',
  outfile: bundle,
  platform: 'neutral',
  target: 'es2017',
})

const result = spawnSync(hermes, ['-O', '-emit-binary', '-out', bytecode, bundle], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(result.stderr || result.stdout)
console.log('Hermes bytecode compile smoke passed.')
