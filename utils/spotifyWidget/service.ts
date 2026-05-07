/** Integration base URL, error copy, and fetch with localhost `/api` fallback. */

import { normalizeUserApiOrigin } from '../integrationApiOrigin';
import type { SpotifyApiErrorBody } from './types';

export const formatSpotifyErrorMessage = (
  endpoint: string,
  status: number | null,
  body: SpotifyApiErrorBody | null,
  isExtension: boolean
): string => {
  const hasHttpApi = /^https?:\/\//i.test(endpoint);
  if (isExtension && !hasHttpApi) {
    return 'Spotify: add your deployed origin in Settings → Advanced → Integration API (base URL).';
  }
  if (status === 404) {
    return 'Spotify: no /api route here — set Integration API base URL in Settings.';
  }
  if (body?.stage === 'missing_env') {
    return 'Spotify: deploy needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN.';
  }
  if (body?.details) {
    return `Spotify: ${body.details}`;
  }
  if (status != null) {
    return `Spotify unavailable (HTTP ${status})`;
  }
  return 'Spotify: network error — check API URL or connection.';
};

/** Saved settings origin, or same-origin `/api` (no build-time default in the extension). */
export const resolveSpotifyApiUrl = (userBase: string) => {
  const base = normalizeUserApiOrigin(userBase);
  if (base) {
    if (/\/api\/spotify-now-playing$/i.test(base)) return base;
    return `${base}/api/spotify-now-playing`;
  }
  return '/api/spotify-now-playing';
};

/** Retry same-origin when privacy mode blocks cross-origin on localhost dev. */
export async function spotifyFetchNowPlaying(endpoint: string): Promise<Response> {
  try {
    return await fetch(endpoint, { cache: 'no-store' });
  } catch (err) {
    const isLocalhost = /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname);
    const canFallback = isLocalhost && endpoint !== '/api/spotify-now-playing';
    if (!canFallback) throw err;
    return await fetch('/api/spotify-now-playing', { cache: 'no-store' });
  }
}
