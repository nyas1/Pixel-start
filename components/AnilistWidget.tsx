import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

type AnilistEntry = {
  id: number;
  progress: number;
  mediaId: number;
  listStatus: 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING';
  completedAtTs: number | null;
  nextAiringInSec: number | null;
  title: string;
  episodes: number | null;
  status: string | null;
  airedEpisodes: number | null;
  coverImage: string;
  siteUrl: string;
};

type AnilistListStatus = 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING';
type AnilistFilter = AnilistListStatus;

type WidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: AnilistEntry[] };

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const MAX_SHOWN_LISTS = 3;
const LIST_LABELS: Record<AnilistListStatus, string> = {
  CURRENT: 'Watching',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
  DROPPED: 'Dropped',
  PLANNING: 'Planning'
};
const VALID_LISTS: AnilistListStatus[] = ['CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED', 'PLANNING'];

const QUERY = `
query AnimeLists($userName: String!, $statusIn: [MediaListStatus]) {
  MediaListCollection(userName: $userName, type: ANIME, status_in: $statusIn, sort: UPDATED_TIME_DESC) {
    lists {
      status
      entries {
        id
        status
        progress
        completedAt {
          year
          month
          day
        }
        media {
          id
          episodes
          status
          siteUrl
          nextAiringEpisode {
            episode
            timeUntilAiring
          }
          title {
            romaji
            english
            native
          }
          coverImage {
            medium
          }
        }
      }
    }
  }
}
`;

const pickTitle = (media: any): string =>
  media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled';

const formatProgress = (entry: AnilistEntry): string => {
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

const toCompletedTimestamp = (completedAt: any): number | null => {
  const year = Number(completedAt?.year || 0);
  const month = Number(completedAt?.month || 0);
  const day = Number(completedAt?.day || 0);
  if (!year || !month || !day) return null;
  const ts = Date.UTC(year, month - 1, day);
  return Number.isFinite(ts) ? ts : null;
};

export const AnilistWidget: React.FC = () => {
  const { anilistUsername, anilistShownLists, anilistLinkTarget } = useAppContext();
  const [state, setState] = useState<WidgetState>({ status: 'loading' });
  const [filter, setFilter] = useState<AnilistFilter>('CURRENT');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    const username = anilistUsername.trim();
    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, MAX_SHOWN_LISTS);

    if (!username) {
      setState({ status: 'error', message: 'AniList: set username in Settings -> Advanced.' });
      return;
    }

    const fetchEntries = async () => {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        };

        const res = await fetch(ANILIST_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: QUERY,
            variables: { userName: username, statusIn: selectedLists }
          })
        });

        if (!res.ok) throw new Error(`AniList API error (${res.status})`);

        const body = await res.json();
        if (body?.errors?.length) {
          const msg = body.errors[0]?.message || 'request failed';
          throw new Error(msg);
        }

        const lists = body?.data?.MediaListCollection?.lists || [];
        const rawEntries =
          lists.flatMap((list: any) =>
            (list?.entries || []).map((entry: any) => ({
              ...entry,
              __listStatus: entry?.status || list?.status || 'CURRENT'
            }))
          ) || [];
        const items: AnilistEntry[] = rawEntries
          .map((entry: any): AnilistEntry => ({
            id: entry.id,
            progress: entry.progress || 0,
            mediaId: entry.media?.id || 0,
            listStatus: VALID_LISTS.includes(entry.__listStatus) ? entry.__listStatus : 'CURRENT',
            completedAtTs: toCompletedTimestamp(entry.completedAt),
            nextAiringInSec:
              entry.media?.status === 'RELEASING'
                ? Number(entry.media?.nextAiringEpisode?.timeUntilAiring ?? 0) || null
                : null,
            title: pickTitle(entry.media),
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

        if (!alive) return;
        setState({ status: 'success', items });
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'unknown error';
        setState({ status: 'error', message: `AniList: ${msg}` });
      }
    };

    setState({ status: 'loading' });
    fetchEntries();
    const timer = window.setInterval(fetchEntries, 600000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [anilistShownLists, anilistUsername, refreshNonce]);

  useEffect(() => {
    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, MAX_SHOWN_LISTS);
    if (!selectedLists.includes(filter)) {
      setFilter(selectedLists[0] || 'CURRENT');
    }
  }, [anilistShownLists, filter]);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return <p className="text-xs text-[var(--color-muted,#888888)]">loading...</p>;
    }
    if (state.status === 'error') {
      return <p className="text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</p>;
    }
    if (state.items.length === 0) {
      return <p className="text-xs text-[var(--color-muted,#888888)]">No anime found in selected lists.</p>;
    }

    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, MAX_SHOWN_LISTS);
    const filteredItems = state.items.filter((item) => item.listStatus === filter);
    const visibleItems =
      filter === 'COMPLETED'
        ? [...filteredItems].sort((a, b) => (b.completedAtTs || 0) - (a.completedAtTs || 0))
        : filteredItems;
    if (visibleItems.length === 0) {
      return <p className="text-xs text-[var(--color-muted,#888888)]">No anime found in selected lists.</p>;
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          {(selectedLists as AnilistFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`border px-1.5 py-0.5 text-[10px] font-mono no-radius ${
                filter === option
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              [{LIST_LABELS[option].toUpperCase()}]
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {visibleItems.map((entry) => (
            <li key={entry.id}>
              {/** Use AniList ID route for Miruro links when enabled. */}
              {(() => {
                const href =
                  anilistLinkTarget === 'miruro'
                    ? `https://www.miruro.to/watch/${entry.mediaId}/`
                    : entry.siteUrl;
                return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-[var(--color-accent)]"
                title={entry.title}
              >
                {entry.coverImage ? (
                  <img src={entry.coverImage} alt="" className="h-10 w-7 shrink-0 object-cover" loading="lazy" />
                ) : (
                  <div className="h-10 w-7 shrink-0 border border-[var(--color-border)]" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">{entry.title}</p>
                  <p className="font-mono text-[10px] text-[var(--color-muted,#888888)]">
                    {entry.status === 'RELEASING' ? (
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-400 align-middle"
                        aria-label="currently airing"
                        title="Currently airing"
                      />
                    ) : null}
                    {formatProgress(entry)}
                  </p>
                </div>
              </a>
                );
              })()}
            </li>
          ))}
        </ul>
      </div>
    );
  }, [anilistLinkTarget, anilistShownLists, filter, state]);

  return (
    <div className="h-full overflow-auto pr-1 custom-scrollbar">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setRefreshNonce((v) => v + 1)}
          className="border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono no-radius text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          [REFRESH]
        </button>
      </div>
      {content}
    </div>
  );
};
