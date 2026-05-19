/**
 * After `vite build --mode extension`, copy dist/assets → firefox_addon/assets
 * and align hashed index-*.js / index-*.css in firefox_addon/newtab.html with dist/index.html.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const distIndex = path.join(root, 'dist', 'index.html')
const newtabPath = path.join(root, 'firefox_addon', 'newtab.html')
const srcAssets = path.join(root, 'dist', 'assets')
const destAssets = path.join(root, 'firefox_addon', 'assets')
const srcImages = path.join(root, 'dist', 'images')
const destImages = path.join(root, 'firefox_addon', 'images')

if (!fs.existsSync(distIndex)) {
  console.error('Missing dist/index.html — run npm run build:extension first.')
  process.exit(1)
}
if (!fs.existsSync(srcAssets)) {
  console.error('Missing dist/assets — run npm run build:extension first.')
  process.exit(1)
}

const distHtml = fs.readFileSync(distIndex, 'utf8')
const jsMatch = distHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/)
const cssMatch = distHtml.match(/href="\.\/assets\/(index-[^"]+\.css)"/)
if (!jsMatch || !cssMatch) {
  console.error('Could not find ./assets/index-*.js or index-*.css in dist/index.html')
  process.exit(1)
}

let newtab = fs.readFileSync(newtabPath, 'utf8')
newtab = newtab.replace(/src="\.\/assets\/index-[^"]+\.js"/, `src="./assets/${jsMatch[1]}"`)
newtab = newtab.replace(/href="\.\/assets\/index-[^"]+\.css"/, `href="./assets/${cssMatch[1]}"`)
fs.writeFileSync(newtabPath, newtab)

if (fs.existsSync(destAssets)) {
  fs.rmSync(destAssets, { recursive: true })
}
fs.mkdirSync(destAssets, { recursive: true })
for (const name of fs.readdirSync(srcAssets)) {
  fs.cpSync(path.join(srcAssets, name), path.join(destAssets, name), { recursive: true })
}

if (fs.existsSync(srcImages)) {
  if (fs.existsSync(destImages)) {
    fs.rmSync(destImages, { recursive: true })
  }
  fs.mkdirSync(destImages, { recursive: true })
  for (const name of fs.readdirSync(srcImages)) {
    fs.cpSync(path.join(srcImages, name), path.join(destImages, name), { recursive: true })
  }
}

console.log('Synced dist → firefox_addon (assets + images + newtab.html hashes).')
