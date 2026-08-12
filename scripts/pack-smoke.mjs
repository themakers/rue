import { access, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = new URL('..', import.meta.url).pathname
const output = join(root, '.cache', 'pack-smoke')
const extracted = join(output, 'extracted')
const consumer = await mkdtemp(join(tmpdir(), 'rue-pack-smoke-'))

try {
  await rm(output, { force: true, recursive: true })
  await mkdir(extracted, { recursive: true })

  const packed = spawnSync('pnpm', ['pack', '--pack-destination', output], {
    cwd: root,
    encoding: 'utf8',
  })
  if (packed.status !== 0) throw new Error(packed.stderr || packed.stdout)

  const archive = (await readdir(output)).find((file) => file.endsWith('.tgz'))
  if (!archive) throw new Error('pnpm pack did not create an archive')
  const archivePath = join(output, archive)

  const unpacked = spawnSync('tar', ['-xzf', archivePath, '-C', extracted], {
    encoding: 'utf8',
  })
  if (unpacked.status !== 0) throw new Error(unpacked.stderr || unpacked.stdout)

  const packageRoot = join(extracted, 'package')
  for (const file of [
    'README.md',
    'MIGRATION.md',
    'LICENSE',
    'dist/rue.js',
    'dist/rue.cjs',
    'dist/rue.d.ts',
  ]) {
    await access(join(packageRoot, file))
  }

  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@themakers/rue': `file:${archivePath}`,
        '@vue/reactivity': '3.5.41',
        react: '19.2.8',
      },
    }),
  )

  const installed = spawnSync('pnpm', ['install', '--ignore-scripts'], {
    cwd: consumer,
    encoding: 'utf8',
  })
  if (installed.status !== 0) throw new Error(installed.stderr || installed.stdout)

  const assertion = "if (typeof require('@themakers/rue').useReactive !== 'function') process.exit(1)"
  const cjs = spawnSync('node', ['-e', assertion], { cwd: consumer, encoding: 'utf8' })
  if (cjs.status !== 0) throw new Error(cjs.stderr || cjs.stdout || 'Packed CJS export failed')

  const esm = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "import('@themakers/rue').then((m) => { if (typeof m.useReactive !== 'function') process.exit(1) })",
    ],
    { cwd: consumer, encoding: 'utf8' },
  )
  if (esm.status !== 0) throw new Error(esm.stderr || esm.stdout || 'Packed ESM export failed')

  console.log(`Packed archive ${archive} installs and loads by package name through ESM and CJS.`)
} finally {
  await rm(output, { force: true, recursive: true })
  await rm(consumer, { force: true, recursive: true })
}
