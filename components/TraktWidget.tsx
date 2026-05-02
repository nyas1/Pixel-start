import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import {
  TRAKT_AUTH_STORAGE_KEY,
  readTraktJson,
  writeTraktJson,
  traktApiUrl,
  traktGetJson,
  traktOAuthPostHeaders,
  formatTraktFetchError,
  type TraktStoredAuth
} from '../utils/traktClient';

type TraktWatchedItem = {
  traktId: number;
  tmdbId: number | null;
  title: string;
  year: number | null;
  nextEpisode: string;
  watchedAt: string | null;
  showUrl: string;
  showSlug: string;
  posterImage: string;
};

type TraktNowWatching = {
  showTraktId: number;
  tmdbId: number | null;
  title: string;
  year: number | null;
  episode: string;
  episodeTitle: string;
  progressPct: number | null;
  pausedAt: string | null;
  showUrl: string;
  showSlug: string;
  posterImage: string;
};

type TraktContinueItem = {
  id: number;
  tmdbId: number | null;
  title: string;
  year: number | null;
  episode: string;
  episodeTitle: string;
  progressPct: number;
  pausedAt: string | null;
  showUrl: string;
  showSlug: string;
  posterImage: string;
};

type WidgetState =
  | { status: 'idle'; message: string }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      nowWatching: TraktNowWatching | null;
      continueItems: TraktContinueItem[];
      fallbackItems: TraktWatchedItem[];
    };

type TraktListTab = 'now' | 'continue' | 'recent';

const MAX_ITEMS = 12;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';
const TMDB_API_BASE =
  /^localhost$|^127\.0\.0\.1$|^::1$|^\[::1\]$|^0\.0\.0\.0$/.test(window.location.hostname)
    ? '/tmdb-api'
    : 'https://api.themoviedb.org/3';
const TRAKT_LIST_TAB_STORAGE_KEY = 'tui-trakt-list-tab';

const TRAKT_REFRESH_BTN_CLASS =
  'px-0.5 py-0 text-[15px] leading-none font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none';

const formatEpisodeCode = (season: number | null, number: number | null): string => {
  if (season == null || number == null) return 'N/A';
  return `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;
};

const traktPosterFallback = (traktId: number | null): string =>
  Number.isFinite(traktId || NaN) && Number(traktId) > 0
    ? `https://walter.trakt.tv/images/shows/${Number(traktId)}/posters/thumb.jpg`
    : '';

const getRelativeAge = (dateIso: string | null): string => {
  if (!dateIso) return '';
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
};

const dedupeContinueItems = (items: TraktContinueItem[]): TraktContinueItem[] => {
  const byKey = new Map<string, TraktContinueItem>();
  for (const item of items) {
    const key = item.showSlug;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      continue;
    }
    const prevTs = new Date(prev.pausedAt || 0).getTime();
    const nextTs = new Date(item.pausedAt || 0).getTime();
    if (nextTs >= prevTs) byKey.set(key, item);
  }
  return [...byKey.values()];
};

const toWatchedItems = (body: any): TraktWatchedItem[] => {
  const arr = Array.isArray(body) ? body : [];
  return arr
    .map((entry: any): TraktWatchedItem | null => {
      const show = entry?.show;
      const episode = entry?.next_episode;
      const ids = show?.ids;
      if (!show || !ids?.trakt) return null;
      const traktId = Number(ids.trakt);
      if (!Number.isFinite(traktId)) return null;
      const showSlug = String(ids?.slug || traktId);
      const tmdbIdRaw = Number(ids?.tmdb);
      const tmdbId = Number.isFinite(tmdbIdRaw) && tmdbIdRaw > 0 ? tmdbIdRaw : null;
      return {
        traktId,
        tmdbId,
        title: String(show.title || 'Untitled'),
        year: Number.isFinite(show.year) ? Number(show.year) : null,
        nextEpisode: formatEpisodeCode(
          Number.isFinite(episode?.season) ? Number(episode.season) : null,
          Number.isFinite(episode?.number) ? Number(episode.number) : null
        ),
        watchedAt: typeof entry?.last_watched_at === 'string' ? entry.last_watched_at : null,
        showUrl: `https://trakt.tv/shows/${showSlug}`,
        showSlug,
        posterImage: ''
      };
    })
    .filter((x: TraktWatchedItem | null): x is TraktWatchedItem => x !== null)
    .slice(0, MAX_ITEMS);
};

const toNowWatching = (body: any): TraktNowWatching | null => {
  if (!body || body?.type !== 'episode') return null;
  const show = body?.show;
  const episode = body?.episode;
  if (!show || !show?.ids?.trakt) return null;
  const slug = String(show?.ids?.slug || show?.ids?.trakt);
  const tmdbIdRaw = Number(show?.ids?.tmdb);
  const tmdbId = Number.isFinite(tmdbIdRaw) && tmdbIdRaw > 0 ? tmdbIdRaw : null;
  return {
    showTraktId: Number(show?.ids?.trakt),
    tmdbId,
    title: String(show?.title || 'Untitled'),
    year: Number.isFinite(show?.year) ? Number(show.year) : null,
    episode: formatEpisodeCode(
      Number.isFinite(episode?.season) ? Number(episode.season) : null,
      Number.isFinite(episode?.number) ? Number(episode.number) : null
    ),
    episodeTitle: String(episode?.title || ''),
    progressPct: Number.isFinite(Number(body?.progress)) ? Math.max(0, Math.min(100, Math.round(Number(body?.progress)))) : null,
    pausedAt: typeof body?.paused_at === 'string' ? body.paused_at : null,
    showUrl: `https://trakt.tv/shows/${slug}`,
    showSlug: slug,
    posterImage: ''
  };
};

const toContinueItems = (body: any): TraktContinueItem[] => {
  const arr = Array.isArray(body) ? body : [];
  return dedupeContinueItems(
    arr
    .filter((entry: any) => entry?.show && entry?.show?.ids?.trakt)
    .map((entry: any): TraktContinueItem => {
      const show = entry.show;
      const nextEpisode = entry?.next_episode || null;
      const lastEpisode = entry?.last_episode || null;
      const episode = nextEpisode || lastEpisode || {};
      const completedRaw = Number(entry?.completed);
      const airedRaw = Number(entry?.aired);
      const progressRaw = Number(entry?.progress);
      const progressPct = Number.isFinite(progressRaw)
        ? Math.max(0, Math.min(100, Math.round(progressRaw)))
        : (Number.isFinite(completedRaw) && Number.isFinite(airedRaw) && airedRaw > 0
          ? Math.max(0, Math.min(100, Math.round((completedRaw / airedRaw) * 100)))
          : 0);
      const traktId = Number(show?.ids?.trakt);
      const slug = String(show?.ids?.slug || show?.ids?.trakt);
      const tmdbIdRaw = Number(show?.ids?.tmdb);
      const tmdbId = Number.isFinite(tmdbIdRaw) && tmdbIdRaw > 0 ? tmdbIdRaw : null;
      return {
        id: traktId,
        tmdbId,
        title: String(show?.title || 'Untitled'),
        year: Number.isFinite(show?.year) ? Number(show.year) : null,
        episode: formatEpisodeCode(
          Number.isFinite(episode?.season) ? Number(episode.season) : null,
          Number.isFinite(episode?.number) ? Number(episode.number) : null
        ),
        episodeTitle: String(episode?.title || ''),
        progressPct,
        pausedAt:
          typeof entry?.last_watched_at === 'string'
            ? entry.last_watched_at
            : (typeof entry?.reset_at === 'string' ? entry.reset_at : null),
        showUrl: `https://trakt.tv/shows/${slug}`,
        showSlug: slug,
        posterImage: traktPosterFallback(traktId)
      };
    })
    .sort((a, b) => {
      const t = new Date(b.pausedAt || 0).getTime() - new Date(a.pausedAt || 0).getTime();
      if (t !== 0) return t;
      return b.progressPct - a.progressPct;
    })
    .slice(0, MAX_ITEMS)
  );
};

const toContinueItemsFromPlayback = (body: any): TraktContinueItem[] => {
  const arr = Array.isArray(body) ? body : [];
  return dedupeContinueItems(
    arr
    .filter((entry: any) => entry?.type === 'episode' && entry?.show?.ids?.trakt && entry?.episode)
    .map((entry: any): TraktContinueItem => {
      const show = entry.show;
      const episode = entry.episode;
      const traktId = Number(show.ids.trakt);
      const slug = String(show.ids.slug || traktId);
      const tmdbIdRaw = Number(show?.ids?.tmdb);
      const tmdbId = Number.isFinite(tmdbIdRaw) && tmdbIdRaw > 0 ? tmdbIdRaw : null;
      const progressRaw = Number(entry.progress);
      return {
        id: traktId,
        tmdbId,
        title: String(show.title || 'Untitled'),
        year: Number.isFinite(show.year) ? Number(show.year) : null,
        episode: formatEpisodeCode(
          Number.isFinite(episode?.season) ? Number(episode.season) : null,
          Number.isFinite(episode?.number) ? Number(episode.number) : null
        ),
        episodeTitle: String(episode?.title || ''),
        progressPct: Number.isFinite(progressRaw)
          ? Math.max(0, Math.min(100, Math.round(progressRaw)))
          : 0,
        pausedAt: typeof entry.paused_at === 'string' ? entry.paused_at : null,
        showUrl: `https://trakt.tv/shows/${slug}`,
        showSlug: slug,
        posterImage: traktPosterFallback(traktId)
      };
    })
    .sort((a, b) => {
      const t = new Date(b.pausedAt || 0).getTime() - new Date(a.pausedAt || 0).getTime();
      if (t !== 0) return t;
      return b.progressPct - a.progressPct;
    })
    .slice(0, MAX_ITEMS)
  );
};

const readErrorSuffix = async (res: Response): Promise<string> => {
  try {
    const body: any = await res.clone().json();
    const msg = body?.error_description || body?.error || body?.message;
    return msg ? `: ${String(msg)}` : '';
  } catch {
    return '';
  }
};

async function getRefreshedAuth(clientId: string, clientSecret: string): Promise<TraktStoredAuth> {
  const auth = readTraktJson<TraktStoredAuth>(TRAKT_AUTH_STORAGE_KEY);
  if (!auth?.accessToken || !auth?.refreshToken) {
    throw new Error('Connect Trakt first.');
  }

  const earlyMs = 60_000;
  if (Date.now() < auth.expiresAt - earlyMs) {
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
    const sfx = await readErrorSuffix(res);
    writeTraktJson(TRAKT_AUTH_STORAGE_KEY, null);
    throw new Error(`Token refresh failed (${res.status})${sfx}. Disconnect and reconnect in Settings.`);
  }

  const body = await res.json();
  const refreshed: TraktStoredAuth = {
    accessToken: String(body?.access_token || '').trim(),
    refreshToken: String(body?.refresh_token || auth.refreshToken || '').trim(),
    expiresAt: Date.now() + (Number(body?.expires_in || 3600) * 1000),
    createdAt: Date.now(),
    oauthClientId: cid
  };

  if (!refreshed.accessToken || !refreshed.refreshToken) {
    writeTraktJson(TRAKT_AUTH_STORAGE_KEY, null);
    throw new Error('Invalid token response. Please reconnect Trakt.');
  }

  // Important: Trakt may rotate refresh_token, so persist latest value immediately.
  writeTraktJson(TRAKT_AUTH_STORAGE_KEY, refreshed);
  return refreshed;
}

async function fetchWatchedProgress(clientId: string, token: string): Promise<TraktWatchedItem[]> {
  const res = await traktGetJson(clientId, token, '/users/me/watched/shows?extended=noseasons');
  if (!res.ok) {
    const sfx = await readErrorSuffix(res);
    throw new Error(`Trakt watch data error (${res.status})${sfx}`);
  }
  const body = await res.json();
  return toWatchedItems(body);
}

async function fetchNowWatching(clientId: string, token: string): Promise<TraktNowWatching | null> {
  const res = await traktGetJson(clientId, token, '/users/me/watching');
  if (res.status === 204) return null;
  if (!res.ok) {
    const sfx = await readErrorSuffix(res);
    throw new Error(`Trakt now watching error (${res.status})${sfx}`);
  }
  const body = await res.json();
  return toNowWatching(body);
}

async function fetchContinueWatching(clientId: string, token: string): Promise<TraktContinueItem[]> {
  const primary = '/users/me/progress/watched?hidden=false&specials=false&count_specials=false';

  let res = await traktGetJson(clientId, token, primary);
  if (res.ok) {
    const body = await res.json();
    return toContinueItems(body);
  }

  const primarySfx = await readErrorSuffix(res);
  if (res.status !== 401 && res.status !== 403) {
    throw new Error(`Trakt continue watching error (${res.status})${primarySfx}`);
  }

  const fallbacks = ['/sync/playback/episodes', '/sync/playback'];
  let lastSfx = primarySfx;
  for (const url of fallbacks) {
    res = await traktGetJson(clientId, token, url);
    if (res.ok) {
      const body = await res.json();
      return toContinueItemsFromPlayback(body);
    }
    lastSfx = (await readErrorSuffix(res)) || lastSfx;
  }
  throw new Error(`Trakt continue watching error (${res.status})${lastSfx}`);
}

async function fetchPlaybackNowProgress(clientId: string, token: string): Promise<TraktContinueItem[]> {
  const endpoints = ['/sync/playback/episodes', '/sync/playback'];
  for (const url of endpoints) {
    try {
      const res = await traktGetJson(clientId, token, url);
      if (!res.ok) continue;
      const body = await res.json();
      const items = toContinueItemsFromPlayback(body);
      if (items.length > 0) return items;
    } catch {
      // Best-effort only: keep widget working even if playback endpoint is unavailable.
    }
  }
  return [];
}

async function fetchTmdbPosterMap(tmdbIds: number[], tmdbToken: string): Promise<Record<number, string>> {
  const token = tmdbToken.trim();
  const uniqueIds = [...new Set(tmdbIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 20);
  if (!token || uniqueIds.length === 0) return {};

  // Accept either TMDB v4 read token (JWT-ish) or legacy v3 API key.
  const isV4Bearer = token.includes('.');

  const entries = await Promise.all(
    uniqueIds.map(async (tmdbId) => {
      try {
        const url = isV4Bearer
          ? `${TMDB_API_BASE}/tv/${tmdbId}?language=en-US`
          : `${TMDB_API_BASE}/tv/${tmdbId}?language=en-US&api_key=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: isV4Bearer
            ? {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
              }
            : {
                Accept: 'application/json'
              }
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

async function fetchTraktPosterMap(clientId: string, token: string, slugs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(slugs.filter(Boolean))].slice(0, 10);
  if (unique.length === 0) return {};
  const entries = await Promise.all(
    unique.map(async (slug) => {
      try {
        const res = await traktGetJson(
          clientId,
          token,
          `/shows/${encodeURIComponent(slug)}?extended=full,images`
        );
        if (!res.ok) return [slug, ''] as const;
        const body = await res.json();
        const poster =
          body?.images?.poster?.[0] ||
          body?.images?.poster?.full ||
          body?.images?.poster?.medium ||
          body?.images?.poster?.thumb ||
          '';
        return [slug, String(poster || '')] as const;
      } catch {
        return [slug, ''] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export const TraktWidget: React.FC = () => {
  const { tmdbApiKey, traktClientId, traktClientSecret } = useAppContext();
  const [state, setState] = useState<WidgetState>({
    status: 'idle',
    message: 'Connect Trakt in Settings -> Advanced -> Trakt Widget.'
  });
  const [listTab, setListTab] = useState<TraktListTab>(() => {
    const raw = localStorage.getItem(TRAKT_LIST_TAB_STORAGE_KEY);
    return raw === 'now' || raw === 'continue' || raw === 'recent' ? raw : 'continue';
  });
  const [hasSavedListTab, setHasSavedListTab] = useState<boolean>(() => {
    const raw = localStorage.getItem(TRAKT_LIST_TAB_STORAGE_KEY);
    return raw === 'now' || raw === 'continue' || raw === 'recent';
  });
  const [manualRefresh, setManualRefresh] = useState(0);

  const requestRefresh = useCallback(() => {
    setManualRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    if (state.status !== 'success') return;
    const hasNow = !!state.nowWatching;
    const c = state.continueItems.length;
    const r = state.fallbackItems.length;
    if (!hasSavedListTab) {
      setListTab(hasNow ? 'now' : 'continue');
      return;
    }
    if (listTab === 'continue' && c === 0 && r > 0) setListTab('recent');
    else if (listTab === 'recent' && r === 0 && c > 0) setListTab('continue');
  }, [hasSavedListTab, listTab, state]);

  useEffect(() => {
    if (!hasSavedListTab) return;
    localStorage.setItem(TRAKT_LIST_TAB_STORAGE_KEY, listTab);
  }, [hasSavedListTab, listTab]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const stored = readTraktJson<TraktStoredAuth>(TRAKT_AUTH_STORAGE_KEY);
      if (!stored?.refreshToken) {
        if (!alive) return;
        setState({
          status: 'idle',
          message: 'Not connected. Open Settings -> Advanced -> Trakt Widget and click [ CONNECT ].'
        });
        return;
      }

      const cid = traktClientId.trim();
      const sec = traktClientSecret.trim();
      if (!cid || !sec) {
        if (!alive) return;
        setState({
          status: 'error',
          message: 'Trakt needs Client ID and Client Secret in Settings (Advanced). They stay in local storage on this device.'
        });
        return;
      }
      if (stored.oauthClientId && stored.oauthClientId !== cid) {
        if (!alive) return;
        setState({
          status: 'error',
          message: 'Trakt Client ID does not match this connection. Disconnect in Settings and connect again.'
        });
        return;
      }

      setState({ status: 'loading' });
      try {
        const auth = await getRefreshedAuth(cid, sec);
        const [nowWatchingBase, continueItemsBase, fallbackItemsBase, playbackItemsBase] = await Promise.all([
          fetchNowWatching(cid, auth.accessToken),
          fetchContinueWatching(cid, auth.accessToken),
          fetchWatchedProgress(cid, auth.accessToken),
          fetchPlaybackNowProgress(cid, auth.accessToken)
        ]);
        const tmdbBySlug: Record<string, number> = {};
        if (nowWatchingBase?.tmdbId) tmdbBySlug[nowWatchingBase.showSlug] = nowWatchingBase.tmdbId;
        for (const item of continueItemsBase) {
          if (item.tmdbId) tmdbBySlug[item.showSlug] = item.tmdbId;
        }
        for (const item of fallbackItemsBase) {
          if (item.tmdbId) tmdbBySlug[item.showSlug] = item.tmdbId;
        }

        const [tmdbPosterMap, traktPosterMap] = await Promise.all([
          fetchTmdbPosterMap(
            Object.values(tmdbBySlug),
            tmdbApiKey || String((import.meta as any).env?.VITE_TMDB_API_KEY || '')
          ),
          fetchTraktPosterMap(cid, auth.accessToken, [
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
                  (item.episode === nowWatchingBase.episode || nowWatchingBase.episode === 'N/A')
              ) ||
              nowFallbackPool.find((item) => item.showSlug === nowWatchingBase.showSlug)
            : null;

        const nowWatching = nowWatchingBase
          ? {
              ...nowWatchingBase,
              progressPct: nowWatchingBase.progressPct ?? nowWatchingProgressFallback?.progressPct ?? null,
              pausedAt: nowWatchingBase.pausedAt ?? nowWatchingProgressFallback?.pausedAt ?? null,
              posterImage:
                (nowWatchingBase.tmdbId ? tmdbPosterMap[nowWatchingBase.tmdbId] : '') ||
                traktPosterMap[nowWatchingBase.showSlug] ||
                traktPosterFallback(nowWatchingBase.showTraktId)
            }
          : null;
        const continueItems = continueItemsBase.map((item) => ({
          ...item,
          posterImage:
            (item.tmdbId ? tmdbPosterMap[item.tmdbId] : '') ||
            traktPosterMap[item.showSlug] ||
            item.posterImage ||
            traktPosterFallback(item.id)
        }));
        const fallbackItems = fallbackItemsBase.map((item) => ({
          ...item,
          posterImage:
            (item.tmdbId ? tmdbPosterMap[item.tmdbId] : '') ||
            traktPosterMap[item.showSlug] ||
            traktPosterFallback(item.traktId)
        }));
        if (!alive) return;
        setState({ status: 'success', nowWatching, continueItems, fallbackItems });
      } catch (error) {
        if (!alive) return;
        const msg = formatTraktFetchError(error);
        setState({ status: 'error', message: `Trakt: ${msg}` });
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 300000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tmdbApiKey, manualRefresh, traktClientId, traktClientSecret]);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-muted,#888888)]">loading...</p>
          <button type="button" disabled className={TRAKT_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
            ↻
          </button>
        </div>
      );
    }
    if (state.status === 'error') {
      return (
        <div className="space-y-2">
          <p className="text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</p>
          <div className="flex justify-end">
            <button type="button" onClick={requestRefresh} className={TRAKT_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
              ↻
            </button>
          </div>
        </div>
      );
    }
    if (state.status === 'idle') {
      return <p className="text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</p>;
    }
    if (state.continueItems.length === 0 && !state.nowWatching && state.fallbackItems.length === 0) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-muted,#888888)]">No watched shows yet.</p>
          <div className="flex justify-end">
            <button type="button" onClick={requestRefresh} className={TRAKT_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
              ↻
            </button>
          </div>
        </div>
      );
    }
    const showListTabs = true;

    return (
      <div className="space-y-3">
        {showListTabs ? (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                  onClick={() => {
                    setListTab('now');
                    setHasSavedListTab(true);
                  }}
                className={`border px-1.5 py-0.5 text-[10px] font-mono no-radius ${
                  listTab === 'now'
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                [NOW]
              </button>
              <button
                type="button"
                  onClick={() => {
                    setListTab('continue');
                    setHasSavedListTab(true);
                  }}
                className={`border px-1.5 py-0.5 text-[10px] font-mono no-radius ${
                  listTab === 'continue'
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                [CONTINUE]
              </button>
              <button
                type="button"
                  onClick={() => {
                    setListTab('recent');
                    setHasSavedListTab(true);
                  }}
                className={`border px-1.5 py-0.5 text-[10px] font-mono no-radius ${
                  listTab === 'recent'
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                [RECENT]
              </button>
              <button type="button" onClick={requestRefresh} className={`${TRAKT_REFRESH_BTN_CLASS} ml-auto`} aria-label="Refresh" title="Refresh">
                ↻
              </button>
            </div>
            {listTab === 'now' ? (
              state.nowWatching ? (
                <a href={state.nowWatching.showUrl} target="_blank" rel="noreferrer" className="block hover:text-[var(--color-accent)]">
                  <div className="flex flex-col items-center gap-2 py-1 text-center">
                    {state.nowWatching.posterImage ? (
                      <img src={state.nowWatching.posterImage} alt="" className="h-[7.8rem] w-[5.2rem] shrink-0 object-cover" loading="lazy" />
                    ) : (
                      <div className="h-[7.8rem] w-[5.2rem] shrink-0 border border-[var(--color-border)]" />
                    )}
                    <div className="w-full min-w-0">
                      <p className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">
                        {state.nowWatching.title} {state.nowWatching.year ? `(${state.nowWatching.year})` : ''}
                      </p>
                      <p className="truncate font-mono text-[10px] text-[var(--color-muted,#888888)]">
                        {state.nowWatching.episode} {state.nowWatching.episodeTitle ? `· ${state.nowWatching.episodeTitle}` : ''}
                      </p>
                      {state.nowWatching.progressPct != null || state.nowWatching.pausedAt ? (
                        <p className="truncate font-mono text-[10px] text-[var(--color-muted,#888888)]">
                          {state.nowWatching.progressPct != null ? `${state.nowWatching.progressPct}%` : ''}
                          {state.nowWatching.pausedAt
                            ? `${state.nowWatching.progressPct != null ? ' · ' : ''}paused ${getRelativeAge(state.nowWatching.pausedAt)} ago`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </a>
              ) : (
                <div className="flex flex-col items-center gap-2 py-1 text-center">
                  <div className="flex h-[7.8rem] w-[5.2rem] items-center justify-center border border-[var(--color-border)] text-3xl text-[var(--color-muted,#888888)]">
                    :(
                  </div>
                  <div className="w-full min-w-0">
                    <p className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">nothing is playing</p>
                    <p className="truncate font-mono text-[10px] text-[var(--color-muted,#888888)]">play something</p>
                  </div>
                </div>
              )
            ) : listTab === 'continue' ? (
              state.continueItems.length > 0 ? (
                <ul className="space-y-2">
                  {state.continueItems.map((item) => (
                    <li key={`continue-${item.id}-${item.episode}`}>
                      <a
                        href={item.showUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block hover:text-[var(--color-accent)]"
                        title={item.title}
                      >
                        <div className="flex items-center gap-2">
                          {item.posterImage ? (
                            <img src={item.posterImage} alt="" className="h-10 w-7 shrink-0 object-cover" loading="lazy" />
                          ) : (
                            <div className="h-10 w-7 shrink-0 border border-[var(--color-border)]" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">
                                {item.title} {item.year ? `(${item.year})` : ''}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted,#888888)]">
                                {getRelativeAge(item.pausedAt)}
                              </span>
                            </div>
                            <p className="truncate font-mono text-[10px] text-[var(--color-muted,#888888)]">
                              {item.episode} {item.episodeTitle ? `· ${item.episodeTitle}` : ''} · {item.progressPct}%
                            </p>
                          </div>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--color-muted,#888888)]">Nothing in continue watching.</p>
              )
            ) : state.fallbackItems.length > 0 ? (
              <ul className="space-y-2">
                {state.fallbackItems.map((item) => (
                  <li key={item.traktId}>
                    <a
                      href={item.showUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block hover:text-[var(--color-accent)]"
                      title={item.title}
                    >
                      <div className="flex items-center gap-2">
                        {item.posterImage ? (
                          <img src={item.posterImage} alt="" className="h-10 w-7 shrink-0 object-cover" loading="lazy" />
                        ) : (
                          <div className="h-10 w-7 shrink-0 border border-[var(--color-border)]" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">
                              {item.title} {item.year ? `(${item.year})` : ''}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted,#888888)]">
                              {getRelativeAge(item.watchedAt)}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-[var(--color-muted,#888888)]">
                            next: {item.nextEpisode}
                          </p>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-muted,#888888)]">Nothing in recent watched.</p>
            )}
          </>
        ) : state.nowWatching ? (
          <div className="flex items-center justify-end">
            <button type="button" onClick={requestRefresh} className={TRAKT_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
              ↻
            </button>
          </div>
        ) : null}
      </div>
    );
  }, [listTab, requestRefresh, state]);

  return (
    <div className="h-full overflow-auto pr-1 custom-scrollbar">
      {content}
    </div>
  );
};

