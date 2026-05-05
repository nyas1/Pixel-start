/**
 * Switch firefox_addon/manifest.json between Firefox (MV2, XPI) and Chrome (MV3) templates.
 * Usage: node scripts/set-extension-manifest.mjs firefox|chrome
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const addonDir = path.join(__dirname, '..', 'firefox_addon')
const mode = process.argv[2]
const src =
  mode === 'chrome'
    ? path.join(addonDir, 'manifest.chrome.json')
    : mode === 'firefox'
      ? path.join(addonDir, 'manifest.firefox.json')
      : null

if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/set-extension-manifest.mjs firefox|chrome')
  process.exit(1)
}

fs.copyFileSync(src, path.join(addonDir, 'manifest.json'))
console.log(`firefox_addon/manifest.json <- ${path.basename(src)}`)
