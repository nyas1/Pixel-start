/** POST to AniList GraphQL; throws on HTTP or GraphQL errors. */

import { ANILIST_GRAPHQL_ENDPOINT, ANILIST_MEDIA_LIST_QUERY } from './constants';
import { buildAnilistEntriesFromResponse } from './model';
import type { AnilistEntry, AnilistListStatus } from './types';

export async function fetchAnilistAnimeEntries(
  userName: string,
  statusIn: AnilistListStatus[]
): Promise<AnilistEntry[]> {
  const res = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      query: ANILIST_MEDIA_LIST_QUERY,
      variables: { userName, statusIn }
    })
  });

  if (!res.ok) throw new Error(`AniList API error (${res.status})`);

  const body = await res.json();
  if (body?.errors?.length) {
    const msg = body.errors[0]?.message || 'request failed';
    throw new Error(msg);
  }

  return buildAnilistEntriesFromResponse(body, statusIn);
}
