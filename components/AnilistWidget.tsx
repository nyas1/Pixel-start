/** Anime lists from AniList GraphQL (public); tabs + optional Miruro links. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import {
  ANILIST_MAX_SHOWN_LISTS,
  ANILIST_LIST_LABELS,
  ANILIST_REFRESH_BTN_CLASS,
  ANILIST_VALID_LISTS,
  ANILIST_WIDGET_POLL_MS
} from '../utils/anilistWidget/constants';
import { formatAnilistProgress } from '../utils/anilistWidget/model';
import { fetchAnilistAnimeEntries } from '../utils/anilistWidget/service';
import type { AnilistFilter, AnilistListStatus, AnilistWidgetState } from '../utils/anilistWidget/types';

export const AnilistWidget: React.FC = () => {
  const { anilistUsername, anilistShownLists, anilistLinkTarget } = useAppContext();
  const [state, setState] = useState<AnilistWidgetState>({ status: 'loading' });
  const [filter, setFilter] = useState<AnilistFilter>('CURRENT');
  const [manualRefresh, setManualRefresh] = useState(0);
  const requestRefresh = useCallback(() => {
    setManualRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    const username = anilistUsername.trim();
    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => ANILIST_VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, ANILIST_MAX_SHOWN_LISTS);

    if (!username) {
      setState({ status: 'error', message: 'AniList: set username in Settings -> Advanced.' });
      return;
    }

    const fetchEntries = async () => {
      try {
        const items = await fetchAnilistAnimeEntries(username, selectedLists);
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
    const timer = window.setInterval(fetchEntries, ANILIST_WIDGET_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [anilistShownLists, anilistUsername, manualRefresh]);

  /** Keep active tab valid when Settings trims visible lists. */
  useEffect(() => {
    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => ANILIST_VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, ANILIST_MAX_SHOWN_LISTS);
    if (!selectedLists.includes(filter)) {
      setFilter(selectedLists[0] || 'CURRENT');
    }
  }, [anilistShownLists, filter]);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-muted,#888888)]">loading...</p>
          <button type="button" disabled className={ANILIST_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
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
            <button type="button" onClick={requestRefresh} className={ANILIST_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
              ↻
            </button>
          </div>
        </div>
      );
    }
    if (state.items.length === 0) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-muted,#888888)]">No anime found in selected lists.</p>
          <div className="flex justify-end">
            <button type="button" onClick={requestRefresh} className={ANILIST_REFRESH_BTN_CLASS} aria-label="Refresh" title="Refresh">
              ↻
            </button>
          </div>
        </div>
      );
    }

    const selectedLists = (anilistShownLists.length ? anilistShownLists : ['CURRENT'])
      .filter((value): value is AnilistListStatus => ANILIST_VALID_LISTS.includes(value as AnilistListStatus))
      .slice(0, ANILIST_MAX_SHOWN_LISTS);
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
              [{ANILIST_LIST_LABELS[option].toUpperCase()}]
            </button>
          ))}
          <button type="button" onClick={requestRefresh} className={`${ANILIST_REFRESH_BTN_CLASS} ml-auto`} aria-label="Refresh" title="Refresh">
            ↻
          </button>
        </div>
        <ul className="space-y-2">
          {visibleItems.map((entry) => {
            const href =
              anilistLinkTarget === 'miruro'
                ? `https://www.miruro.to/watch/${entry.mediaId}/`
                : entry.siteUrl;
            return (
              <li key={entry.id}>
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
                    <p className="font-mono text-[10px] text-[var(--color-muted,#888888)]">{formatAnilistProgress(entry)}</p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }, [anilistLinkTarget, anilistShownLists, filter, requestRefresh, state]);

  return <div className="h-full overflow-auto pr-1 custom-scrollbar">{content}</div>;
};
