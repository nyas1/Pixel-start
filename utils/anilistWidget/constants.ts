/** GraphQL document, UI labels, and polling for AnilistWidget. */

import type { AnilistListStatus } from './types';

export const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

export const ANILIST_MAX_SHOWN_LISTS = 3;

export const ANILIST_LIST_LABELS: Record<AnilistListStatus, string> = {
  CURRENT: 'Watching',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
  DROPPED: 'Dropped',
  PLANNING: 'Planning'
};

export const ANILIST_VALID_LISTS: AnilistListStatus[] = [
  'CURRENT',
  'COMPLETED',
  'PAUSED',
  'DROPPED',
  'PLANNING'
];

export const ANILIST_REFRESH_BTN_CLASS =
  'px-0.5 py-0 text-[15px] leading-none font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none';

export const ANILIST_WIDGET_POLL_MS = 120_000;

/** One query for all selected list statuses (tabs). */
export const ANILIST_MEDIA_LIST_QUERY = `
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
