import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svg = path.join(root, 'firefox_addon', 'icon-terminal-tab.svg')
const out48 = path.join(root, 'firefox_addon', 'icon48.png')
const out96 = path.join(root, 'firefox_addon', 'icon96.png')

await sharp(svg).resize(48, 48).png().toFile(out48)
await sharp(svg).resize(96, 96).png().toFile(out96)
console.log('Wrote firefox_addon/icon48.png and icon96.png from icon-terminal-tab.svg')
