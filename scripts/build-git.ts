import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

async function buildBundle(
  entrypoint: string,
  format: 'esm' | 'cjs',
  target: 'browser' | 'node',
  output: string,
  banner: string,
) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    format,
    target,
    external: ['react', '@vue/reactivity'],
    minify: true,
    banner,
  })

  if (!result.success || result.outputs.length !== 1) {
    for (const log of result.logs) console.error(log)
    throw new Error(`Bun failed to build the Rue ${format} bundle`)
  }

  await Bun.write(output, result.outputs[0])
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'rue-git-build-'))

try {
  const temporarySource = join(temporaryRoot, 'src')

  // Bun's barrel optimization currently drops local implementations when it
  // sees Rue's `sideEffects: false`. A source-only build root avoids that bug
  // without weakening the package metadata used by downstream bundlers.
  await cp(join(root, 'src'), temporarySource, { recursive: true })

  const packageJson = await Bun.file(join(root, 'package.json')).json()
  const banner = `/*!
 * ${packageJson.name} v${packageJson.version}
 * ${packageJson.homepage}
 *
 * Uses @vue/reactivity
 * https://github.com/vuejs/core/tree/main/packages/reactivity
 *
 * (c) 2021-present Surmon, Veact contributors, and Rue contributors.
 * Released under the ${packageJson.license} License.
 */`
  const entrypoint = join(temporarySource, 'index.ts')

  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await Promise.all([
    buildBundle(entrypoint, 'esm', 'browser', join(dist, 'rue.js'), banner),
    buildBundle(entrypoint, 'cjs', 'node', join(dist, 'rue.cjs'), banner),
  ])

  // Bun keeps the git dependency's source tree, so TypeScript can consume the
  // original declarations without requiring tsc or vite-plugin-dts at install.
  await writeFile(join(dist, 'rue.d.ts'), "export * from '../src/index'\n")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
