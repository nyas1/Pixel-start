# Integrations Setup (Extension)

## Shared: Integration API (Spotify + GitHub)

**Fork this repo, deploy on [Vercel](https://vercel.com/new).** In the extension: **Settings -> Advanced -> Integration API -> Base URL** = production URL (no trailing slash). Set env vars in **Vercel -> Settings -> Environment Variables**, then redeploy.

## Spotify

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard): create app, copy Client ID/Secret, redirect URI `http://127.0.0.1:5555/callback`.
2. Open (replace `YOUR_CLIENT_ID`):

```text
https://accounts.spotify.com/authorize?response_type=code&client_id=YOUR_CLIENT_ID&scope=user-read-currently-playing%20user-read-recently-played&redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcallback
```

3. Copy `code` from `http://127.0.0.1:5555/callback?code=...`

4. In **PowerShell**:

```powershell
$body = @{
  grant_type    = 'authorization_code'
  code          = 'PASTE_CODE_HERE'
  redirect_uri  = 'http://127.0.0.1:5555/callback'
  client_id     = 'YOUR_CLIENT_ID'
  client_secret = 'YOUR_CLIENT_SECRET'
}

Invoke-RestMethod `
  -Method Post `
  -Uri 'https://accounts.spotify.com/api/token' `
  -ContentType 'application/x-www-form-urlencoded' `
  -Body $body
```

5. Vercel env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` (from response `refresh_token`). Redeploy.
6. Extension: enable **Spotify** widget.

## GitHub

1. Vercel env: `GITHUB_TOKEN` (PAT with repo/issue read access you need). Redeploy.
2. Extension: enable **GitHub** widget, set **GitHub Username**.

## AniList

Enable **AniList** widget → **Settings -> Advanced -> AniList Widget** → **AniList Username**.

## Trakt

1. [Trakt API Apps](https://trakt.tv/oauth/applications): **Client ID** and **Client Secret**.
2. Extension: enable **Trakt** → **Settings -> Advanced -> Trakt Widget** → paste credentials, **TMDB API Key (for posters)** from [TMDB API Settings](https://www.themoviedb.org/settings/api) (required) → **CONNECT**, open URL, enter code.
