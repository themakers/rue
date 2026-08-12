import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['src', 'dist']
const extensions = new Set(['.ts', '.js', '.cjs', '.mjs'])
const forbidden = [
  /(?:from\s*|import\s*(?:\(|)|require\s*\()\s*['"]react-dom(?:\/[^'"]*)?['"]/,
  /(?:from\s*|import\s*(?:\(|)|require\s*\()\s*['"]react-native(?:\/[^'"]*)?['"]/,
  /unstable_batchedUpdates/,
  /\b(?:window|document|navigator)\b/,
]

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collect(path)))
    else if (extensions.has(extname(path))) files.push(path)
  }

  return files
}

const violations = []
for (const root of roots) {
  for (const file of await collect(root)) {
    const content = await readFile(file, 'utf8')
    for (const pattern of forbidden) {
      if (pattern.test(content)) violations.push(`${file}: ${pattern}`)
    }
  }
}

if (violations.length) {
  throw new Error(`Platform-specific runtime references found:\n${violations.join('\n')}`)
}

console.log('Runtime source and bundles are platform-neutral.')
