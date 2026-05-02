# Integrations Setup

This guide covers setup for:

- Spotify Now Playing widget
- GitHub Issues & PRs widget
- AniList widget

## Spotify Now Playing

Widget endpoint: `/api/spotify-now-playing` (`api/spotify-now-playing.js` on Vercel: `https://<your-project>.vercel.app/api/spotify-now-playing`).

Get a Spotify refresh token, then set three Vercel env vars.

### 1. Create a Spotify app

- Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- Click **Create app** and note **Client ID** and **Client Secret**.
- Set **Redirect URI** to: `http://127.0.0.1:5555/callback`

### 2. Get an authorization `code`

- Replace `YOUR_CLIENT_ID` in this URL and open it in a browser:

  ```
  https://accounts.spotify.com/authorize?response_type=code&client_id=YOUR_CLIENT_ID&scope=user-read-currently-playing%20user-read-recently-played&redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcallback
  ```

- Log in and approve.
- From `http://127.0.0.1:5555/callback?code=...`, copy the `code` query value before it expires.

### 3. Exchange `code` for a `refresh_token`

- Replace placeholders (`redirect_uri` must exactly match step 1):

  ```bash
  curl -s -X POST "https://accounts.spotify.com/api/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code" \
    -d "code=PASTE_CODE_HERE" \
    -d "redirect_uri=http://127.0.0.1:5555/callback" \
    -d "client_id=YOUR_CLIENT_ID" \
    -d "client_secret=YOUR_CLIENT_SECRET"
  ```

- Copy `refresh_token` from the JSON response.

### 4. Add secrets on Vercel

- In your Vercel project: **Settings** -> **Environment Variables**
- Add:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REFRESH_TOKEN`
- Save and redeploy.

### 5. Configure in Terminal Tab

- Enable **Spotify** widget.
- Open **Settings -> Advanced -> Spotify Widget**.
- Set **Spotify API base URL** to `https://<your-project>.vercel.app` (no trailing slash) when needed (extension / cross-origin host).

## GitHub Issues & PRs

Widget endpoint: `/api/github-work-items` (`api/github-work-items.js` on Vercel: `https://<your-project>.vercel.app/api/github-work-items`).

### 1. Add token on Vercel

- In Vercel env vars, add:
  - `GITHUB_TOKEN` (PAT with read access to repos/issues/PRs you want surfaced)
- Redeploy.

### 2. Configure in Terminal Tab

- Enable **GitHub** widget.
- Open **Settings -> Advanced -> GitHub Widget**.
- Set **GitHub Username**.
- Set **GitHub API base URL** to your deployed origin.

## AniList

AniList is fetched directly from `https://graphql.anilist.co`.

### 1. Configure in Terminal Tab

- Enable **AniList** widget.
- Open **Settings -> Advanced -> AniList Widget**.
- Set:
  - **AniList Username**
