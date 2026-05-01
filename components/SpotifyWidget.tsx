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
    const frame = 'border border-[var(--color-border)] bg-[var(--color-bg)]';
    const artSize = 'w-[min(72%,9.5rem)] aspect-square max-h-[42%] shrink-0';

    if (state.status === 'loading') {
      return (
        <div className={`flex flex-1 flex-col items-center justify-center ${frame} min-h-[4.5rem] w-full`}>
          <span className="text-xs text-[var(--color-muted)] px-2 text-center">loading…</span>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className={`flex flex-1 flex-col items-center justify-center ${frame} min-h-[4.5rem] w-full`}>
          <span className="text-xs text-[var(--color-muted)] px-2 text-center leading-snug">{state.message}</span>
        </div>
      );
    }

    const { data } = state;
    if (!data.title || !data.artist) {
      return (
        <div className="flex flex-1 flex-col items-center justify-start gap-3 pt-1 min-h-0 w-full">
          <div className={`${artSize} ${frame} flex items-center justify-center`}>
            <span className="text-[10px] text-[var(--color-muted)] px-2 text-center">—</span>
          </div>
          <div className="w-full text-center px-1 min-w-0">
            <p className="text-sm font-bold text-[var(--color-fg)] truncate">—</p>
            <p className="text-xs text-[var(--color-muted)] truncate mt-1">nothing yet</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-start gap-3 pt-1 min-h-0 w-full">
        <div className={`${artSize} ${frame} overflow-hidden flex items-center justify-center`}>
          {data.albumImageUrl ? (
            <img
              src={data.albumImageUrl}
              alt={data.album ? `${data.album} cover` : 'album cover'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-[10px] text-[var(--color-muted)] px-2 text-center">no art</span>
          )}
        </div>
        <div className="w-full text-center px-1 min-w-0 flex flex-col gap-1">
          <p className="text-base sm:text-lg font-bold text-[var(--color-fg)] leading-tight truncate">
            {data.title}
          </p>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] font-mono truncate">{data.artist}</p>
        </div>
      </div>
    );
  }, [state]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-stretch overflow-hidden">
      {content}
    </div>
  );
};
