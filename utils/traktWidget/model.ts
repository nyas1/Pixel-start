/** Pure parsers and mappers from Trakt/TMDB JSON to widget rows (no I/O). */

import type { TraktContinueItem, TraktNowWatching, TraktProgressRow, TraktWatchedItem } from './types';
import { TRAKT_WIDGET_MAX_ITEMS, TRAKT_LAST_EP_WATCHED_THRESHOLD_PCT } from './constants';

/** Sentinel when season/episode numbers are missing (matches Trakt-less episode labels). */
export const EPISODE_CODE_NA = 'N/A';

const MS_PER_MINUTE = 60_000;

export const formatEpisodeCode = (season: number | null, number: number | null): string => {
  if (season == null || number == null) return EPISODE_CODE_NA;
  return `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;
};

/** Trakt CDN thumb when TMDB poster is unavailable. */
export const traktPosterFallback = (traktId: number | null): string =>
  Number.isFinite(traktId || NaN) && Number(traktId) > 0
    ? `https://walter.trakt.tv/images/shows/${Number(traktId)}/posters/thumb.jpg`
    : '';

export const getRelativeAge = (dateIso: string | null): string => {
  if (!dateIso) return '';
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / MS_PER_MINUTE));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
};

export const resolveWatchStatus = (
  completed: number | null,
  aired: number | null
): 'caught-up' | 'behind' | null => {
  if (!Number.isFinite(completed) || !Number.isFinite(aired) || (aired || 0) <= 0) return null;
  return (completed || 0) >= (aired || 0) ? 'caught-up' : 'behind';
};

export const isReturningShowStatus = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'returning series' || s === 'in production' || s === 'planned';
};

export const isEndedShowStatus = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'ended' || s === 'canceled';
};

export const readTraktFirstAiredIso = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? raw.trim() : null;
};

export const recentSeriesRunLabel = (item: TraktWatchedItem): 'Ended' | 'Returning' | null => {
  if (isEndedShowStatus(item.showStatus)) return 'Ended';
  if (isReturningShowStatus(item.showStatus)) return 'Returning';
  return null;
};

export const joinRecentLabelParts = (parts: string[]): string => parts.filter(Boolean).join(' · ');

export const readSeasonFromEpisodeCode = (episodeCode: string): number | null => {
  const match = /^S(\d+)E\d+$/i.exec(episodeCode.trim());
  if (!match) return null;
  const season = Number(match[1]);
  return Number.isFinite(season) ? season : null;
};

/** List rows may nest stats under `progress` instead of the root. */
export const getListProgressPayload = (entry: any): any => {
  if (!entry || typeof entry !== 'object') return entry;
  const nested = entry.progress;
  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    ('aired' in nested || 'completed' in nested || 'next_episode' in nested || 'last_episode' in nested)
  ) {
    return nested;
  }
  return entry;
};

const seasonStatsForProgressSeason = (
  seasons: any[] | undefined,
  progressSeason: number
): { seasonCompletedCount: number | null; seasonAiredCount: number | null } => {
  if (!Array.isArray(seasons)) return { seasonCompletedCount: null, seasonAiredCount: null };
  const srow = seasons.find((s: any) => Number(s?.number) === progressSeason);
  if (!srow) return { seasonCompletedCount: null, seasonAiredCount: null };
  const sa = Number(srow.aired);
  const sc = Number(srow.completed);
  const seasonAiredCount =
    Number.isFinite(sa) && sa > 0 ? Math.max(0, Math.floor(sa)) : null;
  const seasonCompletedCount = Number.isFinite(sc) ? Math.max(0, Math.floor(sc)) : null;
  return { seasonCompletedCount, seasonAiredCount };
};

/** One show’s completed/aired + optional season row from a progress body. */
export const extractProgressRowFields = (p: any, canonicalSlug: string): TraktProgressRow => {
  const completedRaw = Number(p?.completed);
  const airedRaw = Number(p?.aired);
  const completedCount = Number.isFinite(completedRaw) ? Math.max(0, Math.floor(completedRaw)) : null;
  const airedCount = Number.isFinite(airedRaw) && airedRaw > 0 ? Math.max(0, Math.floor(airedRaw)) : null;

  const nextEp = p?.next_episode;
  const lastEp = p?.last_episode;
  let progressSeason: number | null = null;
  if (nextEp && Number.isFinite(Number(nextEp.season))) progressSeason = Number(nextEp.season);
  else if (lastEp && Number.isFinite(Number(lastEp.season))) progressSeason = Number(lastEp.season);

  const { seasonCompletedCount, seasonAiredCount } =
    progressSeason != null
      ? seasonStatsForProgressSeason(p?.seasons, progressSeason)
      : { seasonCompletedCount: null, seasonAiredCount: null };

  return {
    showSlug: canonicalSlug,
    completedCount,
    airedCount,
    progressSeason,
    seasonCompletedCount,
    seasonAiredCount,
    nextEpisodeFirstAired: readTraktFirstAiredIso(nextEp?.first_aired),
    lastEpisodeFirstAired: readTraktFirstAiredIso(lastEp?.first_aired)
  };
};

export const progressRowHasUsefulStats = (r: TraktProgressRow): boolean =>
  (r.airedCount != null && r.airedCount > 0) || (r.seasonAiredCount != null && r.seasonAiredCount > 0);

/** Keys by slug and numeric trakt id for lookup from watched list rows. */
export const toProgressRowMap = (body: any): Map<string, TraktProgressRow> => {
  const arr = Array.isArray(body) ? body : [];
  const m = new Map<string, TraktProgressRow>();
  for (const entry of arr) {
    const show = entry?.show;
    if (!show?.ids?.trakt) continue;
    const slugStr = show.ids.slug ? String(show.ids.slug) : null;
    const traktKey = String(show.ids.trakt);
    const canonicalSlug = slugStr || traktKey;
    const p = getListProgressPayload(entry);
    const row = extractProgressRowFields(p, canonicalSlug);
    if (slugStr) m.set(slugStr, row);
    m.set(traktKey, row);
  }
  return m;
};

export const lookupProgressRow = (
  progressBySlug: Map<string, TraktProgressRow>,
  item: TraktWatchedItem
): TraktProgressRow | undefined =>
  progressBySlug.get(item.showSlug) ?? progressBySlug.get(String(item.traktId));

export const missingProgressTotals = (item: TraktWatchedItem): boolean =>
  item.completedCount == null || item.airedCount == null || (item.airedCount ?? 0) <= 0;

export const missingSeasonBreakdown = (item: TraktWatchedItem): boolean =>
  (item.seasonCompletedCount == null || item.seasonAiredCount == null || (item.seasonAiredCount ?? 0) <= 0) &&
  (item.progressSeason != null || readSeasonFromEpisodeCode(item.nextEpisode) != null);

/** Second line under RECENT (caught up vs Sx counts + Ended/Returning). */
export const getRecentProgressLabel = (item: TraktWatchedItem): string => {
  const run = recentSeriesRunLabel(item);
  const hasShowTotals =
    item.completedCount != null && item.airedCount != null && (item.airedCount || 0) > 0;
  const caughtUpOnAired = hasShowTotals && (item.completedCount || 0) >= (item.airedCount || 0);

  if (caughtUpOnAired) {
    return joinRecentLabelParts(['Caught up', ...(run ? [run] : [])]);
  }

  if (hasShowTotals) {
    const season = item.progressSeason ?? readSeasonFromEpisodeCode(item.nextEpisode);
    const hasSeasonRow =
      season != null &&
      item.seasonCompletedCount != null &&
      item.seasonAiredCount != null &&
      (item.seasonAiredCount || 0) > 0;
    const progressPart = hasSeasonRow
      ? `S${season}: ${item.seasonCompletedCount}/${item.seasonAiredCount}`
      : season != null
        ? `S${season}: ${item.completedCount}/${item.airedCount}`
        : `${item.completedCount}/${item.airedCount}`;
    return joinRecentLabelParts([progressPart, ...(run ? [run] : [])]);
  }

  return joinRecentLabelParts([...(run ? [run] : [])]);
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

const sortContinueItemsByRecency = (items: TraktContinueItem[]): TraktContinueItem[] =>
  [...items].sort((a, b) => {
    const t = new Date(b.pausedAt || 0).getTime() - new Date(a.pausedAt || 0).getTime();
    if (t !== 0) return t;
    return b.progressPct - a.progressPct;
  });

const clampProgressPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

const progressPctFromRow = (entry: any, p: any, completedRaw: number, airedRaw: number): number => {
  const progressRaw =
    typeof entry?.progress === 'number'
      ? Number(entry.progress)
      : typeof p?.progress === 'number'
        ? Number(p.progress)
        : Number.NaN;
  if (Number.isFinite(progressRaw)) return clampProgressPct(progressRaw);
  if (Number.isFinite(completedRaw) && Number.isFinite(airedRaw) && airedRaw > 0) {
    return clampProgressPct((completedRaw / airedRaw) * 100);
  }
  return 0;
};

const pickContinuePausedAt = (entry: any, p: any): string | null => {
  if (typeof p?.last_watched_at === 'string') return p.last_watched_at;
  if (typeof entry?.last_watched_at === 'string') return entry.last_watched_at;
  if (typeof p?.reset_at === 'string') return p.reset_at;
  return null;
};

/** `/users/me/watched/shows`; counts filled later from progress map. */
export const toWatchedItems = (body: any): TraktWatchedItem[] => {
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
        completedCount: null,
        airedCount: null,
        watchStatus: null,
        progressSeason: null,
        seasonCompletedCount: null,
        seasonAiredCount: null,
        nextEpisodeFirstAired: readTraktFirstAiredIso(episode?.first_aired),
        lastEpisodeFirstAired: readTraktFirstAiredIso(entry?.last_episode?.first_aired),
        showStatus: null,
        watchedAt: typeof entry?.last_watched_at === 'string' ? entry.last_watched_at : null,
        showUrl: `https://trakt.tv/shows/${showSlug}`,
        showSlug,
        posterImage: ''
      };
    })
    .filter((x: TraktWatchedItem | null): x is TraktWatchedItem => x !== null)
    .slice(0, TRAKT_WIDGET_MAX_ITEMS);
};

/** 204 or non-episode activity yields null. */
export const toNowWatching = (body: any): TraktNowWatching | null => {
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
    progressPct: Number.isFinite(Number(body?.progress))
      ? clampProgressPct(Number(body?.progress))
      : null,
    pausedAt: typeof body?.paused_at === 'string' ? body.paused_at : null,
    showUrl: `https://trakt.tv/shows/${slug}`,
    showSlug: slug,
    posterImage: ''
  };
};

/** Progress/watched list: dedupe by show, sort by last activity. */
export const toContinueItems = (body: any): TraktContinueItem[] => {
  const arr = Array.isArray(body) ? body : [];
  const mapped = arr
    .filter((entry: any) => entry?.show && entry?.show?.ids?.trakt)
    .map((entry: any): TraktContinueItem | null => {
      const show = entry.show;
      const p = getListProgressPayload(entry);
      const nextEpisode = p?.next_episode || null;
      const lastEpisode = p?.last_episode || null;
      const episode = nextEpisode || lastEpisode || {};
      const completedRaw = Number(p?.completed);
      const airedRaw = Number(p?.aired);
      const completedCount = Number.isFinite(completedRaw) ? Math.max(0, Math.floor(completedRaw)) : null;
      const airedCount = Number.isFinite(airedRaw) && airedRaw > 0 ? Math.max(0, Math.floor(airedRaw)) : null;
      const traktId = Number(show?.ids?.trakt);
      const slug = String(show?.ids?.slug || show?.ids?.trakt);
      const tmdbIdRaw = Number(show?.ids?.tmdb);
      const tmdbId = Number.isFinite(tmdbIdRaw) && tmdbIdRaw > 0 ? tmdbIdRaw : null;
      const pct = progressPctFromRow(entry, p, completedRaw, airedRaw);
      const isLastEpisode = !nextEpisode && !!lastEpisode;
      if (isLastEpisode && pct >= TRAKT_LAST_EP_WATCHED_THRESHOLD_PCT) return null;
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
        progressPct: pct,
        completedCount,
        airedCount,
        pausedAt: pickContinuePausedAt(entry, p),
        showUrl: `https://trakt.tv/shows/${slug}`,
        showSlug: slug,
        posterImage: traktPosterFallback(traktId)
      };
    })
    .filter((x: TraktContinueItem | null): x is TraktContinueItem => x !== null);

  return dedupeContinueItems(sortContinueItemsByRecency(mapped)).slice(0, TRAKT_WIDGET_MAX_ITEMS);
};

/** `/sync/playback/*` episode entries when progress/watched is unavailable. */
export const toContinueItemsFromPlayback = (body: any): TraktContinueItem[] => {
  const arr = Array.isArray(body) ? body : [];
  const mapped = arr
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
        progressPct: Number.isFinite(progressRaw) ? clampProgressPct(progressRaw) : 0,
        completedCount: null,
        airedCount: null,
        pausedAt: typeof entry.paused_at === 'string' ? entry.paused_at : null,
        showUrl: `https://trakt.tv/shows/${slug}`,
        showSlug: slug,
        posterImage: traktPosterFallback(traktId)
      };
    });
  return dedupeContinueItems(sortContinueItemsByRecency(mapped)).slice(0, TRAKT_WIDGET_MAX_ITEMS);
};
