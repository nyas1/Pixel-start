/** AniList GraphQL widget. */

export type AnilistEntry = {
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

export type AnilistListStatus = 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING';

export type AnilistFilter = AnilistListStatus;

export type AnilistWidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: AnilistEntry[] };
