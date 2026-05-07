/** Layout + pixel-art tuning for SpotifyWidget. */

/** Internal grid size; canvas downscale then `.pixel-album-art` upscales. */
export const SPOTIFY_ALBUM_PIXEL_GRID = 64;

/** 2.5× the original 5-bar EQ strip. */
export const SPOTIFY_EQ_BAR_COUNT = 13;

/** Art region: cover or logo fills flex space. */
export const SPOTIFY_ART_AREA =
  'min-h-0 w-full flex-1 flex items-stretch justify-center overflow-hidden';

/** Shell so intrinsic bitmap size does not collapse the flex layout. */
export const SPOTIFY_ALBUM_ART_SHELL = 'flex min-h-0 min-w-0 h-full w-full flex-1';

export const SPOTIFY_ALBUM_ART_IMG = 'block h-full w-full min-h-0 min-w-0 object-contain object-center';

export const SPOTIFY_WIDGET_POLL_MS = 15_000;
