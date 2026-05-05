

<p align="center">
  <img src="firefox_addon/icon-terminal-tab.svg" width="72" height="72" alt="Terminal Tab logo">
</p>

<h1 align="center">Terminal Tab</h1>

<p align="center">
  Terminal-core modular new tab dashboard.
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/terminal-newtab/">
    <img src="docs/firefox-add-on-badge.png" width="172" alt="Get the add-on for Firefox">
  </a>
</p>

<p align="center">
  <img src="docs/terminal-tab-preview.png" width="900" alt="Terminal Tab preview">
</p>

---

## Features

- TUI-style modular new tab dashboard with draggable/resizable widgets
- Built-in widgets: search, date/time, stats, weather, links, todo, and fun extras
- Integration widgets:
  - 🟢 Spotify Now Playing
  - 🐙 GitHub Issues/PRs
  - 📺 AniList
  - 🍿 Trakt
- Theme customization, custom CSS, custom tab title/favicon, and presets

## Integrations Setup

- [`INTEGRATIONS_SETUP.md`](./INTEGRATIONS_SETUP.md)

## Build

### Requirements

- **Node.js** 18+
- **npm**
- **Python 3** (for addon packaging script)

### Build Firefox `.xpi`

```bash
npm ci
npm run icons:extension
npm run package:extension
```

Output: `terminal-tab-<version>.xpi` at repo root (version from `firefox_addon/manifest.json`).

### Build Chrome

```bash
npm ci
npm run icons:extension
npm run build:extension
node scripts/sync-firefox-addon-from-dist.mjs
npm run use-manifest:chrome
```

Load in Chrome: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `firefox_addon` folder.

When switching back to Firefox flows, run `npm run use-manifest:firefox` (or `npm run package:extension`, which restores the Firefox manifest automatically).

---

## Credits

This project builds on work from the original repositories:

- [Justheretohack0/Pixel-start](https://github.com/Justheretohack0/Pixel-start)
- [refact0r/re-start](https://github.com/refact0r/re-start)
