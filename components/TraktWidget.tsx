import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

type TraktItem = {
  id: number | string;
  showTitle: string;
  episodeTitle: string;
  season: number | null;
  number: number | null;
  progress: number;
  updatedAt: string;
  url: string;
};

type WidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: TraktItem[] };

type TraktApiErrorBody = {
  error?: string;
  details?: string;
  stage?: string;
};

const LIMIT = 8;

const normalizeUserApiOrigin = (raw: string): string => {
  let s = raw.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, '');
};

const resolveTraktApiUrl = (userBase: string) => {
  const base = normalizeUserApiOrigin(userBase);
  const apiPath = `/api/trakt-continue-watching?limit=${LIMIT}`;
  if (base) return `${base}${apiPath}`;
  return apiPath;
};

const getRelativeAge = (updatedAt: string): string => {
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
};

const episodeCode = (season: number | null, number: number | null): string => {
  if (season == null || number == null) return '--';
  return `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;
};

export const TraktWidget: React.FC = () => {
  const { traktApiBaseUrl } = useAppContext();
  const [state, setState] = useState<WidgetState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const endpoint = resolveTraktApiUrl(traktApiBaseUrl);

    const fetchItems = async () => {
      try {
        const isExtension = window.location.protocol === 'moz-extension:';
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) {
          const status = res.status;
          let parsed: TraktApiErrorBody | null = null;
          try {
            const body = await res.json();
            if (body && typeof body === 'object') parsed = body as TraktApiErrorBody;
          } catch {
            parsed = null;
          }
          if (isExtension && !/^https?:\/\//i.test(traktApiBaseUrl.trim())) {
            throw new Error('set Trakt API base URL in Settings -> Advanced.');
          }
          if (status === 404) throw new Error('no /api route here — set Trakt API base URL.');
          if (parsed?.stage === 'missing_env') throw new Error('server missing TRAKT_* env vars.');
          if (parsed?.details) throw new Error(parsed.details);
          throw new Error(`Trakt API route error (${status})`);
        }

        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!alive) return;
        setState({ status: 'success', items });
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'unknown error';
        setState({ status: 'error', message: `Trakt: ${msg}` });
      }
    };

    setState({ status: 'loading' });
    fetchItems();
    const timer = window.setInterval(fetchItems, 90000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [traktApiBaseUrl]);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return <p className="text-xs text-[var(--color-muted,#888888)]">loading...</p>;
    }
    if (state.status === 'error') {
      return <p className="text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</p>;
    }
    if (state.items.length === 0) {
      return <p className="text-xs text-[var(--color-muted,#888888)]">No in-progress episodes found.</p>;
    }

    return (
      <ul className="space-y-2">
        {state.items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block hover:text-[var(--color-accent)]"
              title={`${item.showTitle}${item.episodeTitle ? ` — ${item.episodeTitle}` : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-mono text-[10px] text-[var(--color-muted,#888888)]">
                  {episodeCode(item.season, item.number)} · {item.progress}%
                </span>
                <span className="font-mono text-[10px] text-[var(--color-muted,#888888)]">{getRelativeAge(item.updatedAt)}</span>
              </div>
              <p className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">{item.showTitle}</p>
              {item.episodeTitle ? (
                <p className="truncate text-[10px] text-[var(--color-muted,#888888)]">{item.episodeTitle}</p>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    );
  }, [state]);

  return <div className="h-full overflow-auto pr-1 custom-scrollbar">{content}</div>;
};
