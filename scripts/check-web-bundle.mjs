import { readFile, readdir } from 'node:fs/promises'

const root = new URL('..', import.meta.url)
const web = new URL('../examples/web/', import.meta.url)
const rootPackage = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const webPackage = JSON.parse(await readFile(new URL('package.json', web), 'utf8'))
const assets = new URL('dist/assets/', web)
const scripts = (await readdir(assets)).filter((file) => file.endsWith('.js'))
const contents = await Promise.all(scripts.map((file) => readFile(new URL(file, assets), 'utf8')))
const bundle = contents.join('\n')

const rendererReact = rootPackage.devDependencies.react
const webReact = webPackage.dependencies.react

if (!bundle.includes(webReact)) throw new Error(`Web bundle does not contain React ${webReact}`)
if (rendererReact !== webReact && bundle.includes(rendererReact)) {
  throw new Error(`Web bundle contains the Expo renderer's React ${rendererReact}`)
}

console.log(`Web bundle contains only its React ${webReact} matrix version.`)
