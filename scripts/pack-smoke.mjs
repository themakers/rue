import { access, mkdir, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const root = new URL('..', import.meta.url).pathname
const output = join(root, '.cache', 'pack-smoke')
const extracted = join(output, 'extracted')

await rm(output, { force: true, recursive: true })
await mkdir(extracted, { recursive: true })

const packed = spawnSync('pnpm', ['pack', '--pack-destination', output], {
  cwd: root,
  encoding: 'utf8',
})
if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout)

const archive = (await readdir(output)).find((file) => file.endsWith('.tgz'))
if (!archive) throw new Error('pnpm pack did not create an archive')

const unpacked = spawnSync('tar', ['-xzf', join(output, archive), '-C', extracted], {
  encoding: 'utf8',
})
if (unpacked.status !== 0) throw new Error(unpacked.stderr || unpacked.stdout)

const packageRoot = join(extracted, 'package')
for (const file of ['README.md', 'MIGRATION.md', 'LICENSE', 'dist/rue.js', 'dist/rue.cjs', 'dist/rue.d.ts']) {
  await access(join(packageRoot, file))
}

const esm = await import(join(packageRoot, 'dist', 'rue.js'))
const cjs = require(join(packageRoot, 'dist', 'rue.cjs'))
if (typeof esm.useReactive !== 'function' || typeof cjs.useReactive !== 'function') {
  throw new Error('Packed ESM or CJS entry point is invalid')
}

console.log(`Packed archive ${archive} loads through ESM and CJS.`)
await rm(output, { force: true, recursive: true })
