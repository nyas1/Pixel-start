/** Tunables and URLs for TraktWidget (shared by UI, model, service). */

/** Max rows shown per Trakt list in the widget. */
export const TRAKT_WIDGET_MAX_ITEMS = 12;

export const TRAKT_LIST_TAB_STORAGE_KEY = 'tui-trakt-list-tab';

/** Matches mono refresh control in widget chrome. */
export const TRAKT_REFRESH_BTN_CLASS =
  'px-0.5 py-0 text-[15px] leading-none font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';

/** Query string for `/progress/watched` and per-show progress. */
export const TRAKT_PROGRESS_WATCHED_QUERY = 'hidden=false&specials=false&count_specials=false';

export const TRAKT_PROGRESS_PAGE_MAX = 40;
export const TRAKT_PROGRESS_PAGE_LIMIT = 250;

export const WIDGET_TRAKT_REFRESH_INTERVAL_MS = 300_000;

export const TMDB_POSTER_FETCH_MAX_IDS = 20;

export const TRAKT_SHOW_META_CHUNK_SIZE = 15;

/** Parallel `/shows/{id}/progress/watched` calls when list stats are thin. */
export const TRAKT_ENRICH_PER_SHOW_BATCH = 4;

/** Refresh access token this long before Trakt `expires_at`. */
export const TRAKT_AUTH_EARLY_REFRESH_MS = 60_000;

export const TRAKT_OAUTH_DEFAULT_EXPIRES_SEC = 3600;

const LOCALHOST_HOST_RE =
  /^localhost$|^127\.0\.0\.1$|^::1$|^\[::1\]$|^0\.0\.0\.0$/;

/** Dev server proxies TMDB at `/tmdb-api` on loopback only. */
export const getTmdbApiBase = (): string =>
  typeof window !== 'undefined' && LOCALHOST_HOST_RE.test(window.location.hostname)
    ? '/tmdb-api'
    : 'https://api.themoviedb.org/3';

const TRANSIENT_TRAKT_HTTP = new Set([429, 502, 503, 504]);

/** Treat as soft failure for supplemental fetches (RECENT list, progress map). */
export const isTransientTraktUpstreamStatus = (status: number): boolean =>
  TRANSIENT_TRAKT_HTTP.has(status);
