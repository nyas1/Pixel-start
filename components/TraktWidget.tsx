/** Trakt NOW / CONTINUE / RECENT UI; data from `loadTraktWidgetSuccessState`. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TRAKT_AUTH_STORAGE_KEY, readTraktJson, formatTraktFetchError } from '../utils/traktClient';
import {
  TRAKT_LIST_TAB_STORAGE_KEY,
  TRAKT_REFRESH_BTN_CLASS,
  WIDGET_TRAKT_REFRESH_INTERVAL_MS
} from '../utils/traktWidget/constants';
import { getRelativeAge, getRecentProgressLabel } from '../utils/traktWidget/model';
import { loadTraktWidgetSuccessState } from '../utils/traktWidget/service';
import type { TraktListTab, TraktWidgetState } from '../utils/traktWidget/types';

export const TraktWidget: React.FC = () => {
  const { tmdbApiKey, traktClientId, traktClientSecret } = useAppContext();
  const [state, setState] = useState<TraktWidgetState>({
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

  /** Pick a sensible default tab when data arrives; flip continue↔recent if one list is empty. */
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

  /** Poll Trakt on interval + when `manualRefresh` bumps (↻). */
  useEffect(() => {
    let alive = true;

    const load = async () => {
      const stored = readTraktJson<{ refreshToken?: string; oauthClientId?: string }>(TRAKT_AUTH_STORAGE_KEY);
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
        const tmdbToken = tmdbApiKey || String((import.meta as { env?: { VITE_TMDB_API_KEY?: string } }).env?.VITE_TMDB_API_KEY || '');
        const { nowWatching, continueItems, fallbackItems } = await loadTraktWidgetSuccessState({
          clientId: cid,
          clientSecret: sec,
          tmdbToken
        });
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
    }, WIDGET_TRAKT_REFRESH_INTERVAL_MS);
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

    return (
      <div className="space-y-3">
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
          <button
            type="button"
            onClick={requestRefresh}
            className={`${TRAKT_REFRESH_BTN_CLASS} ml-auto`}
            aria-label="Refresh"
            title="Refresh"
          >
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
                        ? `${state.nowWatching.progressPct != null ? ' · ' : ''}Paused ${getRelativeAge(state.nowWatching.pausedAt)} ago`
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
                  <a href={item.showUrl} target="_blank" rel="noreferrer" className="block hover:text-[var(--color-accent)]" title={item.title}>
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
                <a href={item.showUrl} target="_blank" rel="noreferrer" className="block hover:text-[var(--color-accent)]" title={item.title}>
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
                      <p className="font-mono text-[10px] text-[var(--color-muted,#888888)]">{getRecentProgressLabel(item)}</p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--color-muted,#888888)]">Nothing in recent watched.</p>
        )}
      </div>
    );
  }, [listTab, requestRefresh, state]);

  return (
    <div className="h-full overflow-auto pr-1 custom-scrollbar">
      {content}
    </div>
  );
};
