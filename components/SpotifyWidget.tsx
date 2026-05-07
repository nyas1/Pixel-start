/** Now playing from integration `/api/spotify-now-playing`; optional pixel cover + EQ. */

import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import {
  SPOTIFY_ALBUM_ART_IMG,
  SPOTIFY_ALBUM_ART_SHELL,
  SPOTIFY_ALBUM_PIXEL_GRID,
  SPOTIFY_ART_AREA,
  SPOTIFY_EQ_BAR_COUNT,
  SPOTIFY_WIDGET_POLL_MS
} from '../utils/spotifyWidget/constants';
import {
  formatSpotifyErrorMessage,
  resolveSpotifyApiUrl,
  spotifyFetchNowPlaying
} from '../utils/spotifyWidget/service';
import type { SpotifyApiErrorBody, SpotifyNowPlaying, SpotifyWidgetState } from '../utils/spotifyWidget/types';

/** Pixel Spotify mark — arc gaps from accent (replaces brand green). */
const SpotifyLogoMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    shapeRendering="crispEdges"
    aria-hidden
    focusable="false"
    preserveAspectRatio="xMidYMid meet"
  >
    <g fill="var(--color-accent)">
      <rect x="8" y="3" width="16" height="1" />
      <rect x="6" y="4" width="20" height="1" />
      <rect x="5" y="5" width="22" height="1" />
      <rect x="4" y="6" width="24" height="1" />
      <rect x="4" y="7" width="24" height="1" />
      <rect x="3" y="8" width="26" height="1" />
      <rect x="3" y="9" width="26" height="1" />
      <rect x="3" y="10" width="26" height="1" />
      <rect x="3" y="11" width="4" height="1" />
      <rect x="25" y="11" width="4" height="1" />
      <rect x="3" y="12" width="5" height="1" />
      <rect x="24" y="12" width="5" height="1" />
      <rect x="3" y="13" width="26" height="1" />
      <rect x="3" y="14" width="26" height="1" />
      <rect x="3" y="15" width="6" height="1" />
      <rect x="23" y="15" width="6" height="1" />
      <rect x="3" y="16" width="7" height="1" />
      <rect x="22" y="16" width="7" height="1" />
      <rect x="3" y="17" width="26" height="1" />
      <rect x="3" y="18" width="26" height="1" />
      <rect x="3" y="19" width="8" height="1" />
      <rect x="21" y="19" width="8" height="1" />
      <rect x="3" y="20" width="9" height="1" />
      <rect x="20" y="20" width="9" height="1" />
      <rect x="3" y="21" width="26" height="1" />
      <rect x="4" y="22" width="24" height="1" />
      <rect x="4" y="23" width="24" height="1" />
      <rect x="5" y="24" width="22" height="1" />
      <rect x="6" y="25" width="20" height="1" />
      <rect x="8" y="26" width="16" height="1" />
    </g>
  </svg>
);

/**
 * Downscale cover to a tiny bitmap (nearest-neighbor); falls back to raw img if canvas is tainted.
 */
const PixelAlbumArt: React.FC<{ src: string; alt: string; pulseWhileLoading: boolean }> = ({
  src,
  alt,
  pulseWhileLoading
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [useOriginal, setUseOriginal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setUseOriginal(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SPOTIFY_ALBUM_PIXEL_GRID;
        canvas.height = SPOTIFY_ALBUM_PIXEL_GRID;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setUseOriginal(true);
          return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, SPOTIFY_ALBUM_PIXEL_GRID, SPOTIFY_ALBUM_PIXEL_GRID);
        setDataUrl(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setUseOriginal(true);
      }
    };
    img.onerror = () => {
      if (!cancelled) setUseOriginal(true);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (useOriginal) {
    return (
      <div className={SPOTIFY_ALBUM_ART_SHELL}>
        <img src={src} alt={alt} className={SPOTIFY_ALBUM_ART_IMG} decoding="async" loading="eager" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`${SPOTIFY_ALBUM_ART_SHELL} rounded-sm bg-[var(--color-hover,#2a2a2a)]${pulseWhileLoading ? ' animate-pulse' : ''}`}
        aria-hidden
      />
    );
  }

  return (
    <div className={SPOTIFY_ALBUM_ART_SHELL}>
      <img src={dataUrl} alt={alt} className={`pixel-album-art ${SPOTIFY_ALBUM_ART_IMG}`} decoding="async" />
    </div>
  );
};

const SpotifyEqBars: React.FC<{ mode: 'playing' | 'idle' }> = ({ mode }) => (
  <div
    className="grid h-4 w-full shrink-0 items-end gap-x-0.5"
    aria-hidden
    style={{ gridTemplateColumns: `repeat(${SPOTIFY_EQ_BAR_COUNT}, minmax(0, 1fr))` }}
  >
    {Array.from({ length: SPOTIFY_EQ_BAR_COUNT }, (_, i) => {
      const phase = i % 5;
      return (
        <div key={i} className="flex min-w-0 justify-center">
          <span
            className={`spotify-eq-bar ${mode === 'playing' ? 'spotify-eq-bar--playing' : 'spotify-eq-bar--idle'}`}
            style={{
              animationDelay: `${i * 0.035}s`,
              animationDuration: `${mode === 'playing' ? 0.38 + phase * 0.05 + (i % 3) * 0.04 : 0.85 + phase * 0.08}s`
            }}
          />
        </div>
      );
    })}
  </div>
);

export const SpotifyWidget: React.FC = () => {
  const { spotifyPixelAlbumArt, spotifyPulse, integrationApiBaseUrl } = useAppContext();
  const [state, setState] = useState<SpotifyWidgetState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    const endpoint = resolveSpotifyApiUrl(integrationApiBaseUrl);

    const fetchNowPlaying = async () => {
      const isExtension = window.location.protocol === 'moz-extension:';
      try {
        const res = await spotifyFetchNowPlaying(endpoint);
        let parsed: unknown = null;
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }
        if (!res.ok) {
          const body = parsed && typeof parsed === 'object' ? (parsed as SpotifyApiErrorBody) : null;
          if (!isMounted) return;
          setState({
            status: 'error',
            message: formatSpotifyErrorMessage(endpoint, res.status, body, isExtension)
          });
          return;
        }
        const data = parsed as SpotifyNowPlaying;
        if (!isMounted) return;
        setState({ status: 'success', data });
      } catch (err) {
        if (!isMounted) return;
        const base = formatSpotifyErrorMessage(endpoint, null, null, isExtension);
        const extra = err instanceof Error ? err.message : '';
        setState({
          status: 'error',
          message: extra ? `${base} (${extra})` : base
        });
      }
    };

    fetchNowPlaying();
    const timer = window.setInterval(fetchNowPlaying, SPOTIFY_WIDGET_POLL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [integrationApiBaseUrl]);

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
    const hasTrack = Boolean(data.title?.trim() && data.artist?.trim());
    const showNowPlaying = data.isPlaying && hasTrack;

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className={SPOTIFY_ART_AREA}>
          {showNowPlaying ? (
            data.albumImageUrl ? (
              spotifyPixelAlbumArt ? (
                <PixelAlbumArt
                  src={data.albumImageUrl}
                  alt={data.album ? `${data.album} cover` : 'album cover'}
                  pulseWhileLoading
                />
              ) : (
                <div className={SPOTIFY_ALBUM_ART_SHELL}>
                  <img
                    src={data.albumImageUrl}
                    alt={data.album ? `${data.album} cover` : 'album cover'}
                    className={SPOTIFY_ALBUM_ART_IMG}
                    decoding="async"
                    loading="eager"
                  />
                </div>
              )
            ) : (
              <span className="text-[10px] text-[var(--color-muted,#888888)]">no art</span>
            )
          ) : (
            <SpotifyLogoMark className="h-full max-h-full w-[min(72%,9.5rem)] shrink-0" />
          )}
        </div>
        <div className="w-full shrink-0 text-center">
          {showNowPlaying ? (
            <>
              <p className="truncate text-base font-bold leading-tight text-[var(--color-fg,#e0e0e0)] sm:text-lg">{data.title}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-muted,#888888)] sm:text-sm">{data.artist}</p>
            </>
          ) : (
            <>
              <p className="truncate text-base font-bold leading-tight text-[var(--color-fg,#e0e0e0)] sm:text-lg">Spotify</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-muted,#888888)] sm:text-sm">no music playing</p>
            </>
          )}
        </div>
        {spotifyPulse ? <SpotifyEqBars mode={showNowPlaying ? 'playing' : 'idle'} /> : null}
      </div>
    );
  }, [state, spotifyPixelAlbumArt, spotifyPulse]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {content}
    </div>
  );
};
