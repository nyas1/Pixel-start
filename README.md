

<p align="center">
  <img src="https://dc.missuo.ru/file/1472237296475443202" width="72" alt="Terminal Tab icon">
</p>

<h1 align="center">Terminal Tab</h1>

<p align="center">
  Retro-inspired, modular new tab dashboard built for focus and speed.
</p>

<p align="center">
  <a href="https://github.com/nyas1/terminal-tab">github.com/nyas1/terminal-tab</a>
</p>

<p align="center">
  <img src="https://dc.missuo.ru/file/1472233821897494592" width="900" alt="Terminal Tab preview">
</p>

---

## Spotify Now Playing

Widget → **`/api/spotify-now-playing`** (`api/spotify-now-playing.js` on Vercel: `https://<your-project>.vercel.app/api/spotify-now-playing`).

Get a **refresh token**, then set three env vars on Vercel.

### 1. Create a Spotify app

- Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- Click **Create app** and note **Client ID** and **Client Secret**.
- **Redirect URIs**: `http://127.0.0.1:5555/callback`

### 2. Get an authorization `code`

- Replace `YOUR_CLIENT_ID` in this URL, then open it in a browser:

  ```
  https://accounts.spotify.com/authorize?response_type=code&client_id=YOUR_CLIENT_ID&scope=user-read-currently-playing%20user-read-recently-played&redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcallback
  ```

- Log in and approve.
- From `http://127.0.0.1:5555/callback?code=...`, copy the **`code`** query value (before it expires).

### 3. Exchange `code` for a `refresh_token`

- Replace placeholders (`redirect_uri` must match step 1):

  ```bash
  curl -s -X POST "https://accounts.spotify.com/api/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code" \
    -d "code=PASTE_CODE_HERE" \
    -d "redirect_uri=http://127.0.0.1:5555/callback" \
    -d "client_id=YOUR_CLIENT_ID" \
    -d "client_secret=YOUR_CLIENT_SECRET"
  ```

- Copy **`refresh_token`** from the JSON.

### 4. Add secrets on Vercel

- In the Vercel project: **Settings** → **Environment Variables**.
- Add:

  - `SPOTIFY_CLIENT_ID` — from the Spotify app
  - `SPOTIFY_CLIENT_SECRET` — from the Spotify app
  - `SPOTIFY_REFRESH_TOKEN` — from the JSON in step 3

- Save and **redeploy**.

### 5. Firefox extension

- **Settings** → **Advanced** → enable **Spotify**.
- Set **Spotify API base URL** to `https://<your-project>.vercel.app` (no trailing slash).


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

- Requires **Firefox 140+** (desktop) / **142+** (Android) for this manifest (built-in data-collection consent).
- **`npm run build:extension`**
- Copy **`dist/assets/`** → **`firefox_addon/assets/`**
- Edit **`firefox_addon/newtab.html`**: set the `<script>` and `<link rel="stylesheet">` **`./assets/...`** paths to the same hashed names as in **`dist/index.html`**.
- **`python package_addon.py`** → **`terminal-tab-<version>.xpi`** (from `firefox_addon/manifest.json`)

---
