/** GraphQL response → sorted rows; progress string for RECENT line. */

import { ANILIST_VALID_LISTS } from './constants';
import type { AnilistEntry, AnilistListStatus } from './types';

export const pickAnilistTitle = (media: any): string =>
  media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled';

export const formatAnilistProgress = (entry: AnilistEntry): string => {
  const total = entry.episodes ?? '?';
  if (entry.status === 'RELEASING') {
    const aired = entry.airedEpisodes ?? '?';
    const daysLeft =
      entry.nextAiringInSec && entry.nextAiringInSec > 0
        ? `${Math.max(1, Math.ceil(entry.nextAiringInSec / 86400))}d`
        : null;
    return `${entry.progress}/[${aired}]${total}${daysLeft ? ` - ${daysLeft}` : ''}`;
  }
  return `${entry.progress}/${total}`;
};

export const toAnilistCompletedTimestamp = (completedAt: any): number | null => {
  const year = Number(completedAt?.year || 0);
  const month = Number(completedAt?.month || 0);
  const day = Number(completedAt?.day || 0);
  if (!year || !month || !day) return null;
  const ts = Date.UTC(year, month - 1, day);
  return Number.isFinite(ts) ? ts : null;
};

/** Flatten lists + sort by Settings tab order. */
export function buildAnilistEntriesFromResponse(
  body: any,
  selectedLists: AnilistListStatus[]
): AnilistEntry[] {
  const lists = body?.data?.MediaListCollection?.lists || [];
  const rawEntries =
    lists.flatMap((list: any) =>
      (list?.entries || []).map((entry: any) => ({
        ...entry,
        __listStatus: entry?.status || list?.status || 'CURRENT'
      }))
    ) || [];

  return rawEntries
    .map((entry: any): AnilistEntry => ({
      id: entry.id,
      progress: entry.progress || 0,
      mediaId: entry.media?.id || 0,
      listStatus: ANILIST_VALID_LISTS.includes(entry.__listStatus) ? entry.__listStatus : 'CURRENT',
      completedAtTs: toAnilistCompletedTimestamp(entry.completedAt),
      nextAiringInSec:
        entry.media?.status === 'RELEASING'
          ? Number(entry.media?.nextAiringEpisode?.timeUntilAiring ?? 0) || null
          : null,
      title: pickAnilistTitle(entry.media),
      episodes: entry.media?.episodes ?? null,
      status: entry.media?.status ?? null,
      airedEpisodes:
        entry.media?.status === 'RELEASING'
          ? Math.max(0, Number((entry.media?.nextAiringEpisode?.episode ?? 1) - 1))
          : null,
      coverImage: entry.media?.coverImage?.medium || '',
      siteUrl: entry.media?.siteUrl || '#'
    }))
    .filter((entry: AnilistEntry) => entry.mediaId > 0)
    .sort(
      (a: AnilistEntry, b: AnilistEntry) =>
        selectedLists.indexOf(a.listStatus) - selectedLists.indexOf(b.listStatus)
    );
}
