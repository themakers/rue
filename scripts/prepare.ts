import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const fullBuildPackages = ['vite', 'vite-plugin-dts', '@vitejs/plugin-react', 'typescript']

const fullBuildAvailable = (
  await Promise.allSettled(
    fullBuildPackages.map((name) => access(join(root, 'node_modules', name, 'package.json'))),
  )
).every((result) => result.status === 'fulfilled')

if (fullBuildAvailable) {
  const build = Bun.spawn(['npm', 'run', 'build'], {
    cwd: root,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await build.exited

  if (exitCode !== 0) throw new Error(`Full Rue build failed with exit code ${exitCode}`)
} else {
  await import('./build-git')
}
