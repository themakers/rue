import { gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'

const limit = 5 * 1024
for (const file of ['dist/rue.js', 'dist/rue.cjs']) {
  const size = gzipSync(await readFile(file), { level: 9 }).byteLength
  if (size > limit) throw new Error(`${file} is ${size} bytes gzip; limit is ${limit}`)
  console.log(`${file}: ${size} bytes gzip`)
}
