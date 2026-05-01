import React, { useEffect, useMemo, useState } from 'react';

type SpotifyNowPlaying = {
  isPlaying: boolean;
  title: string;
  artist: string;
  album?: string;
  albumImageUrl?: string;
  songUrl?: string;
  playedAt?: string;
};

type WidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: SpotifyNowPlaying };

const getEndpoint = () => {
  const envBase = (import.meta.env.VITE_SPOTIFY_API_BASE_URL || '').trim();
  const configuredBase = envBase.replace(/\/+$/, '');
  if (configuredBase) {
    return `${configuredBase}/api/spotify-now-playing`;
  }
  return '/api/spotify-now-playing';
};

/** Art area: no chrome — full cover scales with flex-1 */
const artArea = 'min-h-0 w-full flex-1 flex items-center justify-center overflow-hidden';

export const SpotifyWidget: React.FC = () => {
  const [state, setState] = useState<WidgetState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    const endpoint = getEndpoint();

    const fetchNowPlaying = async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = (await res.json()) as SpotifyNowPlaying;
        if (!isMounted) return;
        setState({ status: 'success', data });
      } catch (_error) {
        if (!isMounted) return;
        const isExtension = window.location.protocol === 'moz-extension:';
        setState({
          status: 'error',
          message: isExtension ? 'set VITE_SPOTIFY_API_BASE_URL for extension build' : 'spotify unavailable'
        });
      }
    };

    fetchNowPlaying();
    const timer = window.setInterval(fetchNowPlaying, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <span className="text-xs text-[var(--color-muted,#888888)]">loading…</span>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1">
          <span className="text-center text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</span>
        </div>
      );
    }

    const { data } = state;
    if (!data.title || !data.artist) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className={artArea}>
            <span className="text-[10px] text-[var(--color-muted,#888888)]">—</span>
          </div>
          <div className="w-full shrink-0 text-center">
            <p className="truncate text-sm font-bold text-[var(--color-fg,#e0e0e0)]">—</p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-muted,#888888)]">nothing yet</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className={artArea}>
          {data.albumImageUrl ? (
            <img
              src={data.albumImageUrl}
              alt={data.album ? `${data.album} cover` : 'album cover'}
              className="max-h-full max-w-full object-contain object-center"
              decoding="async"
              loading="eager"
            />
          ) : (
            <span className="text-[10px] text-[var(--color-muted,#888888)]">no art</span>
          )}
        </div>
        <div className="w-full shrink-0 text-center">
          <p className="truncate text-base font-bold leading-tight text-[var(--color-fg,#e0e0e0)] sm:text-lg">{data.title}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-muted,#888888)] sm:text-sm">{data.artist}</p>
        </div>
      </div>
    );
  }, [state]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {content}
    </div>
  );
};
