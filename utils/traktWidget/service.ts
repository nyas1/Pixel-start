/** Trakt + TMDB fetches, token refresh, and `loadTraktWidgetSuccessState` orchestration. */

import {
  TRAKT_AUTH_STORAGE_KEY,
  readTraktJson,
  writeTraktJson,
  traktApiUrl,
  traktGetJson,
  traktOAuthPostHeaders,
  traktErrorSuffix,
  type TraktStoredAuth
} from '../traktClient';
import {
  TRAKT_ENRICH_PER_SHOW_BATCH,
  TMDB_POSTER_FETCH_MAX_IDS,
  TRAKT_PROGRESS_PAGE_LIMIT,
  TRAKT_PROGRESS_PAGE_MAX,
  TRAKT_PROGRESS_WATCHED_QUERY,
  TRAKT_SHOW_META_CHUNK_SIZE,
  TRAKT_WIDGET_MAX_ITEMS,
  TMDB_IMAGE_BASE,
  TRAKT_AUTH_EARLY_REFRESH_MS,
  TRAKT_OAUTH_DEFAULT_EXPIRES_SEC,
  getTmdbApiBase,
  isTransientTraktUpstreamStatus
} from './constants';
import {
  EPISODE_CODE_NA,
  extractProgressRowFields,
  getListProgressPayload,
  lookupProgressRow,
  missingProgressTotals,
  missingSeasonBreakdown,
  progressRowHasUsefulStats,
  resolveWatchStatus,
  toContinueItems,
  toContinueItemsFromPlayback,
  toNowWatching,
  toProgressRowMap,
  toWatchedItems,
  traktPosterFallback
} from './model';
import type { TraktContinueItem, TraktNowWatching, TraktProgressRow, TraktShowMeta, TraktWatchedItem } from './types';

const USERS_PROGRESS_WATCHED_BASE = `/users/me/progress/watched?${TRAKT_PROGRESS_WATCHED_QUERY}`;

/** Paged `/users/me/progress/watched`, then legacy single-page + `/sync/progress/watched` fallback. */
async function fetchProgressWatchedJsonPages(clientId: string, token: string): Promise<any[] | null> {
  const basePath = USERS_PROGRESS_WATCHED_BASE;
  const collect = async (withExtendedFull: boolean): Promise<any[] | null> => {
    const all: any[] = [];
    const ext = withExtendedFull ? '&extended=full' : '';
    for (let page = 1; page <= TRAKT_PROGRESS_PAGE_MAX; page++) {
      const url = `${basePath}${ext}&page=${page}&limit=${TRAKT_PROGRESS_PAGE_LIMIT}`;
      const res = await traktGetJson(clientId, token, url);
      if (!res.ok) {
        if (page === 1) return null;
        break;
      }
      const body = await res.json();
      const chunk = Array.isArray(body) ? body : [];
      all.push(...chunk);
      if (chunk.length < TRAKT_PROGRESS_PAGE_LIMIT) break;
    }
    return all;
  };

  let rows = await collect(true);
  if (rows == null) rows = await collect(false);
  if (rows != null) return rows;

  let res = await traktGetJson(clientId, token, `${basePath}&extended=full`);
  if (!res.ok) res = await traktGetJson(clientId, token, basePath);
  if (res.ok) {
    const body = await res.json();
    if (Array.isArray(body) && body.length > 0) return body;
  }

  const syncAll: any[] = [];
  for (let page = 1; page <= TRAKT_PROGRESS_PAGE_MAX; page++) {
    const syncUrl = `/sync/progress/watched?page=${page}&limit=${TRAKT_PROGRESS_PAGE_LIMIT}`;
    const syncRes = await traktGetJson(clientId, token, syncUrl);
    if (!syncRes.ok) break;
    const syncBody = await syncRes.json();
    const chunk = Array.isArray(syncBody) ? syncBody : [];
    syncAll.push(...chunk);
    if (chunk.length < TRAKT_PROGRESS_PAGE_LIMIT) break;
  }
  if (syncAll.length > 0) return syncAll;

  return null;
}

async function fetchPerShowProgressRow(
  clientId: string,
  token: string,
  item: TraktWatchedItem
): Promise<TraktProgressRow | null> {
  const run = async (showId: string): Promise<TraktProgressRow | null> => {
    try {
      const res = await traktGetJson(
        clientId,
        token,
        `/shows/${encodeURIComponent(showId)}/progress/watched?${TRAKT_PROGRESS_WATCHED_QUERY}`
      );
      if (!res.ok || isTransientTraktUpstreamStatus(res.status)) return null;
      const body = await res.json();
      const p = getListProgressPayload(body);
      const row = extractProgressRowFields(p, item.showSlug);
      return progressRowHasUsefulStats(row) ? row : null;
    } catch {
      return null;
    }
  };
  return (await run(item.showSlug)) ?? (await run(String(item.traktId)));
}

/** Fills missing aired/completed on RECENT when the bulk map skipped a show. */
export async function enrichFallbackItemsWithPerShowProgress(
  clientId: string,
  token: string,
  items: TraktWatchedItem[]
): Promise<TraktWatchedItem[]> {
  const work = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => missingProgressTotals(it) || missingSeasonBreakdown(it))
    .slice(0, TRAKT_WIDGET_MAX_ITEMS);

  if (work.length === 0) return items;

  const out = [...items];
  for (let i = 0; i < work.length; i += TRAKT_ENRICH_PER_SHOW_BATCH) {
    const chunk = work.slice(i, i + TRAKT_ENRICH_PER_SHOW_BATCH);
    const rows = await Promise.all(chunk.map(({ it }) => fetchPerShowProgressRow(clientId, token, it)));
    chunk.forEach(({ idx }, j) => {
      const row = rows[j];
      if (!row) return;
      const cur = out[idx];
      const completedCount = cur.completedCount ?? row.completedCount;
      const airedCount = cur.airedCount ?? row.airedCount;
      const progressSeason = cur.progressSeason ?? row.progressSeason;
      const seasonCompletedCount = cur.seasonCompletedCount ?? row.seasonCompletedCount;
      const seasonAiredCount = cur.seasonAiredCount ?? row.seasonAiredCount;
      out[idx] = {
        ...cur,
        completedCount,
        airedCount,
        progressSeason,
        seasonCompletedCount,
        seasonAiredCount,
        nextEpisodeFirstAired: cur.nextEpisodeFirstAired ?? row.nextEpisodeFirstAired,
        lastEpisodeFirstAired: cur.lastEpisodeFirstAired ?? row.lastEpisodeFirstAired,
        watchStatus: resolveWatchStatus(completedCount, airedCount)
      };
    });
  }
  return out;
}

/** Never throws; used when continue list comes from playback only. */
async function fetchProgressMapBestEffort(
  clientId: string,
  token: string
): Promise<Map<string, TraktProgressRow>> {
  try {
    const rows = await fetchProgressWatchedJsonPages(clientId, token);
    if (rows == null) return new Map();
    return toProgressRowMap(rows);
  } catch {
    return new Map();
  }
}

/** Persists rotated refresh_token from Trakt when applicable. */
export async function getRefreshedAuth(clientId: string, clientSecret: string): Promise<TraktStoredAuth> {
  const auth = readTraktJson<TraktStoredAuth>(TRAKT_AUTH_STORAGE_KEY);
  if (!auth?.accessToken || !auth?.refreshToken) {
    throw new Error('Connect Trakt first.');
  }

  if (Date.now() < auth.expiresAt - TRAKT_AUTH_EARLY_REFRESH_MS) {
    return auth;
  }

  const cid = clientId.trim();
  const sec = clientSecret.trim();
  if (!cid || !sec) {
    throw new Error('Add Trakt Client ID and Client Secret in Settings (Advanced).');
  }
  if (auth.oauthClientId && auth.oauthClientId !== cid) {
    writeTraktJson(TRAKT_AUTH_STORAGE_KEY, null);
    throw new Error('Trakt Client ID changed. Disconnect and reconnect Trakt in Settings.');
  }

  const res = await fetch(traktApiUrl('/oauth/token'), {
    method: 'POST',
    headers: traktOAuthPostHeaders(cid),
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken.trim(),
      client_id: cid,
      client_secret: sec,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
    })
  });

  if (!res.ok) {
    const sfx = await traktErrorSuffix(res);
    writeTraktJson(TRAKT_AUTH_STORAGE_KEY, null);
    throw new Error(`Token refresh failed (${res.status})${sfx}. Disconnect and reconnect in Settings.`);
  }

  const body = await res.json();
  const refreshed: TraktStoredAuth = {
    accessToken: String(body?.access_token || '').trim(),
    refreshToken: String(body?.refresh_token || auth.refreshToken || '').trim(),
    expiresAt: Date.now() + Number(body?.expires_in || TRAKT_OAUTH_DEFAULT_EXPIRES_SEC) * 1000,
    createdAt: Date.now(),
    oauthClientId: cid
  };

  if (!refreshed.accessToken || !refreshed.refreshToken) {
    writeTraktJson(TRAKT_AUTH_STORAGE_KEY, null);
    throw new Error('Invalid token response. Please reconnect Trakt.');
  }

  writeTraktJson(TRAKT_AUTH_STORAGE_KEY, refreshed);
  return refreshed;
}

/** RECENT source; transient HTTP → empty list (supplemental). */
async function fetchWatchedProgress(clientId: string, token: string): Promise<TraktWatchedItem[]> {
  const res = await traktGetJson(clientId, token, '/users/me/watched/shows?extended=noseasons');
  if (!res.ok) {
    if (isTransientTraktUpstreamStatus(res.status)) return [];
    const sfx = await traktErrorSuffix(res);
    throw new Error(`Trakt watch data error (${res.status})${sfx}`);
  }
  const body = await res.json();
  return toWatchedItems(body);
}

async function fetchNowWatching(clientId: string, token: string): Promise<TraktNowWatching | null> {
  const res = await traktGetJson(clientId, token, '/users/me/watching');
  if (res.status === 204) return null;
  if (!res.ok) {
    const sfx = await traktErrorSuffix(res);
    throw new Error(`Trakt now watching error (${res.status})${sfx}`);
  }
  const body = await res.json();
  return toNowWatching(body);
}

const PLAYBACK_FALLBACK_URLS = ['/sync/playback/episodes', '/sync/playback'] as const;

/** Prefer full progress list; on 401/403/transient, try playback + best-effort progress map. */
async function fetchContinueWatchingBundle(
  clientId: string,
  token: string
): Promise<{ continueItems: TraktContinueItem[]; progressBySlug: Map<string, TraktProgressRow> }> {
  const rows = await fetchProgressWatchedJsonPages(clientId, token);
  if (rows != null) {
    return {
      continueItems: toContinueItems(rows),
      progressBySlug: toProgressRowMap(rows)
    };
  }

  let res = await traktGetJson(clientId, token, USERS_PROGRESS_WATCHED_BASE);
  if (res.ok) {
    const body = await res.json();
    const arr = Array.isArray(body) ? body : [];
    return {
      continueItems: toContinueItems(arr),
      progressBySlug: toProgressRowMap(arr)
    };
  }

  const primarySfx = await traktErrorSuffix(res);
  if (res.status !== 401 && res.status !== 403 && !isTransientTraktUpstreamStatus(res.status)) {
    throw new Error(`Trakt continue watching error (${res.status})${primarySfx}`);
  }

  let lastSfx = primarySfx;
  let lastStatus = res.status;
  let sawTransientFailure = isTransientTraktUpstreamStatus(res.status);
  for (const url of PLAYBACK_FALLBACK_URLS) {
    res = await traktGetJson(clientId, token, url);
    if (res.ok) {
      const body = await res.json();
      const progressBySlug = await fetchProgressMapBestEffort(clientId, token);
      return {
        continueItems: toContinueItemsFromPlayback(body),
        progressBySlug
      };
    }
    lastStatus = res.status;
    if (isTransientTraktUpstreamStatus(res.status)) sawTransientFailure = true;
    lastSfx = (await traktErrorSuffix(res)) || lastSfx;
  }

  if (sawTransientFailure) {
    const progressBySlug = await fetchProgressMapBestEffort(clientId, token);
    return { continueItems: [], progressBySlug };
  }

  throw new Error(`Trakt continue watching error (${lastStatus})${lastSfx}`);
}

/** First non-empty playback response; backs NOW progress fallback. */
async function fetchPlaybackNowProgress(clientId: string, token: string): Promise<TraktContinueItem[]> {
  for (const url of PLAYBACK_FALLBACK_URLS) {
    try {
      const res = await traktGetJson(clientId, token, url);
      if (!res.ok) continue;
      const body = await res.json();
      const items = toContinueItemsFromPlayback(body);
      if (items.length > 0) return items;
    } catch {
      /* best-effort */
    }
  }
  return [];
}

/** v3 api_key or v4 bearer in Settings / env. */
async function fetchTmdbPosterMap(tmdbIds: number[], tmdbToken: string): Promise<Record<number, string>> {
  const token = tmdbToken.trim();
  const uniqueIds = [...new Set(tmdbIds.filter((id) => Number.isFinite(id) && id > 0))].slice(
    0,
    TMDB_POSTER_FETCH_MAX_IDS
  );
  if (!token || uniqueIds.length === 0) return {};

  const isV4Bearer = token.includes('.');
  const base = getTmdbApiBase();

  const entries = await Promise.all(
    uniqueIds.map(async (tmdbId) => {
      try {
        const url = isV4Bearer
          ? `${base}/tv/${tmdbId}?language=en-US`
          : `${base}/tv/${tmdbId}?language=en-US&api_key=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: isV4Bearer
            ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
            : { Accept: 'application/json' }
        });
        if (!res.ok) return [tmdbId, ''] as const;
        const body = await res.json();
        const posterPath = String(body?.poster_path || '');
        if (!posterPath) return [tmdbId, ''] as const;
        return [tmdbId, `${TMDB_IMAGE_BASE}${posterPath}`] as const;
      } catch {
        return [tmdbId, ''] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

async function fetchTraktShowMetaMap(
  clientId: string,
  token: string,
  slugs: string[]
): Promise<Record<string, TraktShowMeta>> {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (unique.length === 0) return {};
  const out: Record<string, TraktShowMeta> = {};
  for (let i = 0; i < unique.length; i += TRAKT_SHOW_META_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + TRAKT_SHOW_META_CHUNK_SIZE);
    const entries = await Promise.all(
      chunk.map(async (slug) => {
        try {
          const res = await traktGetJson(
            clientId,
            token,
            `/shows/${encodeURIComponent(slug)}?extended=full,images`
          );
          if (!res.ok) return [slug, { posterImage: '', status: null }] as const;
          const body = await res.json();
          const poster =
            body?.images?.poster?.[0] ||
            body?.images?.poster?.full ||
            body?.images?.poster?.medium ||
            body?.images?.poster?.thumb ||
            '';
          const status = typeof body?.status === 'string' ? body.status : null;
          return [slug, { posterImage: String(poster || ''), status }] as const;
        } catch {
          return [slug, { posterImage: '', status: null }] as const;
        }
      })
    );
    for (const [slug, meta] of entries) {
      out[slug] = meta;
    }
  }
  return out;
}

/** Resolved posters + merged stats for `setState({ status: 'success', … })`. */
export type TraktWidgetSuccessPayload = {
  nowWatching: TraktNowWatching | null;
  continueItems: TraktContinueItem[];
  fallbackItems: TraktWatchedItem[];
};

/** Single entry for the widget load effect: parallel Trakt calls, then TMDB + Trakt images. */
export async function loadTraktWidgetSuccessState(options: {
  clientId: string;
  clientSecret: string;
  tmdbToken: string;
}): Promise<TraktWidgetSuccessPayload> {
  const cid = options.clientId.trim();
  const auth = await getRefreshedAuth(options.clientId, options.clientSecret);
  const token = auth.accessToken;

  const [nowWatchingBase, continueBundle, fallbackItemsBase, playbackItemsBase] = await Promise.all([
    fetchNowWatching(cid, token),
    fetchContinueWatchingBundle(cid, token),
    fetchWatchedProgress(cid, token),
    fetchPlaybackNowProgress(cid, token)
  ]);

  const continueItemsBase = continueBundle.continueItems;
  const progressBySlug = continueBundle.progressBySlug;

  const tmdbBySlug: Record<string, number> = {};
  if (nowWatchingBase?.tmdbId) tmdbBySlug[nowWatchingBase.showSlug] = nowWatchingBase.tmdbId;
  for (const item of continueItemsBase) {
    if (item.tmdbId) tmdbBySlug[item.showSlug] = item.tmdbId;
  }
  for (const item of fallbackItemsBase) {
    if (item.tmdbId) tmdbBySlug[item.showSlug] = item.tmdbId;
  }

  const [tmdbPosterMap, traktShowMetaMap] = await Promise.all([
    fetchTmdbPosterMap(Object.values(tmdbBySlug), options.tmdbToken),
    fetchTraktShowMetaMap(cid, token, [
      ...(nowWatchingBase?.showSlug ? [nowWatchingBase.showSlug] : []),
      ...continueItemsBase.map((item) => item.showSlug),
      ...fallbackItemsBase.map((item) => item.showSlug)
    ])
  ]);

  const nowFallbackPool = [...playbackItemsBase, ...continueItemsBase];
  const nowWatchingProgressFallback =
    nowWatchingBase && nowWatchingBase.progressPct == null
      ? nowFallbackPool.find(
          (item) =>
            item.showSlug === nowWatchingBase.showSlug &&
            (item.episode === nowWatchingBase.episode || nowWatchingBase.episode === EPISODE_CODE_NA)
        ) || nowFallbackPool.find((item) => item.showSlug === nowWatchingBase.showSlug)
      : null;

  const nowWatching = nowWatchingBase
    ? {
        ...nowWatchingBase,
        progressPct: nowWatchingBase.progressPct ?? nowWatchingProgressFallback?.progressPct ?? null,
        pausedAt: nowWatchingBase.pausedAt ?? nowWatchingProgressFallback?.pausedAt ?? null,
        posterImage:
          (nowWatchingBase.tmdbId ? tmdbPosterMap[nowWatchingBase.tmdbId] : '') ||
          traktShowMetaMap[nowWatchingBase.showSlug]?.posterImage ||
          traktPosterFallback(nowWatchingBase.showTraktId)
      }
    : null;

  const continueItems = continueItemsBase.map((item) => ({
    ...item,
    posterImage:
      (item.tmdbId ? tmdbPosterMap[item.tmdbId] : '') ||
      traktShowMetaMap[item.showSlug]?.posterImage ||
      item.posterImage ||
      traktPosterFallback(item.id)
  }));

  const fallbackItemsMerged = fallbackItemsBase.map((item) => {
    const row = lookupProgressRow(progressBySlug, item);
    const completedCount = row?.completedCount ?? null;
    const airedCount = row?.airedCount ?? null;
    const progressSeason = row?.progressSeason ?? null;
    const seasonCompletedCount = row?.seasonCompletedCount ?? null;
    const seasonAiredCount = row?.seasonAiredCount ?? null;
    const nextEpisodeFirstAired = row?.nextEpisodeFirstAired ?? item.nextEpisodeFirstAired ?? null;
    const lastEpisodeFirstAired = row?.lastEpisodeFirstAired ?? item.lastEpisodeFirstAired ?? null;
    return {
      ...item,
      completedCount,
      airedCount,
      progressSeason,
      seasonCompletedCount,
      seasonAiredCount,
      nextEpisodeFirstAired,
      lastEpisodeFirstAired,
      watchStatus: resolveWatchStatus(completedCount, airedCount),
      showStatus: traktShowMetaMap[item.showSlug]?.status ?? null,
      posterImage:
        (item.tmdbId ? tmdbPosterMap[item.tmdbId] : '') ||
        traktShowMetaMap[item.showSlug]?.posterImage ||
        traktPosterFallback(item.traktId)
    };
  });

  const fallbackItems = await enrichFallbackItemsWithPerShowProgress(cid, token, fallbackItemsMerged);

  return { nowWatching, continueItems, fallbackItems };
}
