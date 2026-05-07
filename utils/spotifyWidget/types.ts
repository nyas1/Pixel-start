/** Spotify now-playing widget (integration API). */

export type SpotifyNowPlaying = {
  isPlaying: boolean;
  title: string;
  artist: string;
  album?: string;
  albumImageUrl?: string;
  songUrl?: string;
  playedAt?: string;
};

export type SpotifyApiErrorBody = {
  error?: string;
  details?: string;
  stage?: string;
};

export type SpotifyWidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: SpotifyNowPlaying };
