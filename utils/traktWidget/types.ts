/** Trakt widget domain types (UI state + API mappers). */

/** One row in the RECENT tab; counts come from progress map + optional per-show fetch. */
export type TraktWatchedItem = {
  traktId: number;
  tmdbId: number | null;
  title: string;
  year: number | null;
  /** e.g. S01E02 or N/A */
  nextEpisode: string;
  completedCount: number | null;
  airedCount: number | null;
  watchStatus: 'caught-up' | 'behind' | null;
  progressSeason: number | null;
  seasonCompletedCount: number | null;
  seasonAiredCount: number | null;
  /** Trakt show `status` (Ended / Returning Series, …). */
  showStatus: string | null;
  nextEpisodeFirstAired: string | null;
  lastEpisodeFirstAired: string | null;
  watchedAt: string | null;
  showUrl: string;
  showSlug: string;
  posterImage: string;
};

/** Normalized stats from a progress/watched payload (slug + trakt id keys in maps). */
export type TraktProgressRow = {
  showSlug: string;
  completedCount: number | null;
  airedCount: number | null;
  progressSeason: number | null;
  seasonCompletedCount: number | null;
  seasonAiredCount: number | null;
  nextEpisodeFirstAired: string | null;
  lastEpisodeFirstAired: string | null;
};

/** `/users/me/watching` episode payload. */
export type TraktNowWatching = {
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

/** CONTINUE tab row (progress list or playback fallback). */
export type TraktContinueItem = {
  id: number;
  tmdbId: number | null;
  title: string;
  year: number | null;
  episode: string;
  episodeTitle: string;
  progressPct: number;
  completedCount: number | null;
  airedCount: number | null;
  pausedAt: string | null;
  showUrl: string;
  showSlug: string;
  posterImage: string;
};

/** NOW / CONTINUE / RECENT data after a successful load. */
export type TraktWidgetState =
  | { status: 'idle'; message: string }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      nowWatching: TraktNowWatching | null;
      continueItems: TraktContinueItem[];
      fallbackItems: TraktWatchedItem[];
    };

export type TraktListTab = 'now' | 'continue' | 'recent';

/** Poster URL + status from `/shows/{slug}?extended=full,images`. */
export type TraktShowMeta = {
  posterImage: string;
  status: string | null;
};
