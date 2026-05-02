

<p align="center">
  <img src="firefox_addon/icon-terminal-tab.svg" width="72" height="72" alt="Terminal Tab logo">
</p>

<h1 align="center">Terminal Tab</h1>

<p align="center">
  Terminal-core, modular new tab dashboard.
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/terminal-newtab/">
    <img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" width="172" alt="Get the add-on for Firefox">
  </a>
</p>

<p align="center">
  <img src="https://dc.missuo.ru/file/1472233821897494592" width="900" alt="Terminal Tab preview">
</p>

---

## Integrations Setup

Setup for Spotify, GitHub, and AniList has been moved to:

- [`INTEGRATIONS_SETUP.md`](./INTEGRATIONS_SETUP.md)


## Build

### Requirements

- **Node.js** 18 or newer
- **npm**
- **Python 3**

### Web app

- Install and build:

  ```bash
  npm install
  npm run build
  ```

- Output: **`dist/`**

### Firefox `.xpi`

- **Listed build:** [Terminal Tab on addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/terminal-newtab/)
- Requires **Firefox 140+** (desktop) / **142+** (Android) for this manifest (built-in data-collection consent).

**One-shot build (recommended):**

```bash
npm ci
npm run icons:extension
npm run package:extension
```

This runs, in order: TypeScript + Vite (`--mode extension`), syncs **`dist/assets/`** into **`firefox_addon/assets/`**, updates hashed **`index-*.js` / `index-*.css`** in **`firefox_addon/newtab.html`** from **`dist/index.html`**, runs **`package_addon.py`** (syncs boot scripts from **`public/`**, zips **`firefox_addon/`**).

Output: **`terminal-tab-<version>.xpi`** at the repo root (version from **`firefox_addon/manifest.json`**).

**Icons:** Run **`npm run icons:extension`** again only after changing **`firefox_addon/icon-terminal-tab.svg`**.

---
