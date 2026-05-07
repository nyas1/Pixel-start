/** Shared Trakt API base + localStorage keys for widget + settings. */

export const TRAKT_AUTH_STORAGE_KEY = 'tui-trakt-auth-v1';
export const TRAKT_DEVICE_STORAGE_KEY = 'tui-trakt-device-v1';

const TRAKT_REMOTE_API_BASE = 'https://api.trakt.tv';

/** Dev proxy only applies on local hosts; ::1 / IPv6 and LAN IPs must not hit api.trakt.tv directly from the browser (CORS). */
const isLocalhost = () => {
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h === '0.0.0.0'
  );
};

/** Where the app is running — drives Trakt error copy (CORS differs for https sites vs extension). */
type TraktAppSurface = 'extension' | 'localhost' | 'public-web';

const getTraktAppSurface = (): TraktAppSurface => {
  if (typeof window === 'undefined') return 'public-web';
  const p = window.location.protocol;
  if (p === 'moz-extension:' || p === 'chrome-extension:') return 'extension';
  if (isLocalhost()) return 'localhost';
  return 'public-web';
};

const isBrowserFetchNetworkError = (message: string) =>
  /NetworkError when attempting to fetch resource|Failed to fetch|Load failed|Network request failed/i.test(
    message
  );

/** User-facing message for thrown errors from Trakt fetch (CORS vs addon permissions vs generic). */
export const formatTraktFetchError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  if (!isBrowserFetchNetworkError(raw)) return raw;

  const surface = getTraktAppSurface();
  if (surface === 'extension') {
    return 'Network fetch blocked. Reload or reinstall the Firefox extension so api.trakt.tv permission is active, then retry.';
  }
  if (surface === 'localhost') {
    return 'Network fetch failed. Check your connection and that the dev server is running (Vite proxies Trakt at /trakt-api on localhost).';
  }
  return 'Trakt cannot be used from this website: the browser blocks cross-origin requests to api.trakt.tv (CORS). Use the Terminal Tab Firefox extension, or run the app locally with npm run dev. A hosted API proxy is not viable because Trakt/Cloudflare often blocks datacenter IPs.';
};

const getTraktApiBase = (): string =>
  isLocalhost() ? '/trakt-api' : TRAKT_REMOTE_API_BASE;

const trimTraktSlash = (s: string): string => s.replace(/\/+$/, '');

/** Full URL for a Trakt API path (uses dev `/trakt-api` proxy on localhost). */
export const traktApiUrl = (path: string): string => {
  const base = trimTraktSlash(getTraktApiBase());
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
};

export type TraktStoredAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  /** OAuth client_id used when tokens were issued; must match Settings Trakt Client ID */
  oauthClientId?: string;
};

/** Required on (almost) all Trakt HTTP calls, including OAuth token endpoints */
export const traktOAuthPostHeaders = (clientId: string): HeadersInit => {
  const id = clientId.trim();
  return {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': id
  };
};

const traktAuthedHeaders = (clientId: string, accessToken: string): HeadersInit => {
  const id = clientId.trim();
  const tok = accessToken.trim();
  return {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': id,
    Authorization: `Bearer ${tok}`
  };
};

export const traktGetJson = (clientId: string, accessToken: string, path: string): Promise<Response> =>
  fetch(traktApiUrl(path), {
    headers: traktAuthedHeaders(clientId, accessToken)
  });

/** Parse Trakt JSON error body for clearer UI messages (uses cloned response). */
export async function traktErrorSuffix(res: Response): Promise<string> {
  try {
    const clone = res.clone();
    const ct = clone.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return '';
    const j: any = await clone.json();
    const err = j?.error_description || j?.error || j?.message;
    if (err != null && String(err).length > 0) return `: ${String(err)}`;
  } catch {
    /* ignore */
  }
  return '';
}

export type TraktDeviceCodeState = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
  startedAt: number;
};

export const readTraktJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeTraktJson = <T,>(key: string, value: T | null) => {
  if (value == null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
};
