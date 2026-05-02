const TRAKT_TOKEN_ENDPOINT = 'https://api.trakt.tv/oauth/token';
const TRAKT_PLAYBACK_ENDPOINT = 'https://api.trakt.tv/sync/playback/episodes?extended=full,show';
const TRAKT_WATCHED_SHOWS_ENDPOINT = 'https://api.trakt.tv/sync/watched/shows';
const USER_AGENT = 'TerminalTab/1.0 (+https://github.com/nyas1/terminal-tab)';
const TOKEN_SKEW_SECONDS = 60;
const MAX_PROGRESS_LOOKUPS = 3;

let tokenCache = {
  accessToken: '',
  clientId: '',
  expiresAtMs: 0
};
let latestRefreshToken = '';
let playbackCache = {
  limit: 0,
  items: null,
  expiresAtMs: 0
};
let cooldownUntilMs = 0;
let showCache = new Map();
let seasonCache = new Map();

const createFailure = (stage, message, statusCode) => {
  const error = new Error(message);
  error.stage = stage;
  if (statusCode) error.statusCode = statusCode;
  return error;
};

const parseLimit = (value) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 8;
  return Math.min(25, Math.max(1, n));
};

const getConfig = () => {
  const clientId = String(process.env.TRAKT_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.TRAKT_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.TRAKT_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw createFailure('missing_env', 'Missing TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, or TRAKT_REFRESH_TOKEN');
  }
  const redirectUri = String(process.env.TRAKT_REDIRECT_URI || '').trim();
  return { clientId, clientSecret, refreshToken, redirectUri };
};

const getAccessToken = async () => {
  const { clientId, clientSecret, refreshToken, redirectUri } = getConfig();
  if (!latestRefreshToken) latestRefreshToken = refreshToken;
  const now = Date.now();
  if (
    tokenCache.accessToken &&
    tokenCache.clientId === clientId &&
    tokenCache.expiresAtMs > now + TOKEN_SKEW_SECONDS * 1000
  ) {
    return { accessToken: tokenCache.accessToken, clientId };
  }

  const tokenBody = {
    grant_type: 'refresh_token',
    refresh_token: latestRefreshToken || refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  };
  if (redirectUri.trim()) tokenBody.redirect_uri = redirectUri.trim();

  const tokenRes = await fetch(TRAKT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      'trakt-api-key': clientId,
      'trakt-api-version': '2'
    },
    body: JSON.stringify(tokenBody)
  });

  let rawText = '';
  try {
    rawText = await tokenRes.text();
  } catch {
    rawText = '';
  }

  let tokenData = null;
  try {
    tokenData = rawText ? JSON.parse(rawText) : null;
  } catch {
    tokenData = null;
  }

  if (!tokenRes.ok) {
    const retryAfter = Number.parseInt(String(tokenRes.headers.get('Retry-After') || ''), 10);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      cooldownUntilMs = Date.now() + retryAfter * 1000;
    }
    const reason =
      tokenData?.error_description ||
      tokenData?.error ||
      tokenData?.message ||
      (rawText ? rawText.slice(0, 200) : `HTTP ${tokenRes.status}`);
    if (tokenRes.status === 400 && String(tokenData?.error || '').toLowerCase() === 'invalid_grant') {
      throw createFailure(
        'token_exchange_failed',
        'Trakt token exchange failed: invalid_grant (refresh token/client/redirect mismatch or rotated token). Re-generate and update TRAKT_REFRESH_TOKEN.',
        tokenRes.status
      );
    }
    throw createFailure('token_exchange_failed', `Trakt token exchange failed: ${reason}`, tokenRes.status);
  }

  if (!tokenData?.access_token) {
    throw createFailure('token_exchange_failed', 'Trakt token response missing access_token');
  }

  const expiresIn = Number(tokenData?.expires_in);
  const expiresAtMs =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? now + expiresIn * 1000
      : now + 55 * 60 * 1000;

  tokenCache = {
    accessToken: tokenData.access_token,
    clientId,
    expiresAtMs
  };
  if (tokenData?.refresh_token && typeof tokenData.refresh_token === 'string') {
    latestRefreshToken = tokenData.refresh_token.trim() || latestRefreshToken;
  }

  return { accessToken: tokenData.access_token, clientId };
};

const traktHeaders = (accessToken, clientId) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': USER_AGENT,
  'trakt-api-key': clientId,
  'trakt-api-version': '2'
});

const getShowMeta = async (accessToken, clientId, slug) => {
  if (!slug) return { posterUrl: '', episodes: null, airedEpisodes: null };
  const key = String(slug);
  const now = Date.now();
  const cached = showCache.get(key);
  if (cached && cached.expiresAtMs > now) return cached.value;
  const res = await fetch(`https://api.trakt.tv/shows/${encodeURIComponent(slug)}?extended=full`, {
    headers: traktHeaders(accessToken, clientId)
  });
  if (!res.ok) return { posterUrl: '', episodes: null, airedEpisodes: null };
  const body = await res.json();
  const value = {
    posterUrl:
      body?.images?.poster?.thumb ||
      body?.images?.poster?.medium ||
      body?.images?.poster?.full ||
      '',
    episodes: Number.isFinite(body?.episodes) ? body.episodes : null,
    airedEpisodes: Number.isFinite(body?.aired_episodes) ? body.aired_episodes : null
  };
  showCache.set(key, { value, expiresAtMs: now + 10 * 60 * 1000 });
  return value;
};

const getSeasonStats = async (accessToken, clientId, slug, season) => {
  if (!slug || season == null) return { airedEpisodes: null, totalEpisodes: null };
  const key = `${slug}:${season}`;
  const now = Date.now();
  const cached = seasonCache.get(key);
  if (cached && cached.expiresAtMs > now) return cached.value;
  const res = await fetch(
    `https://api.trakt.tv/shows/${encodeURIComponent(slug)}/seasons/${encodeURIComponent(String(season))}/episodes?extended=full`,
    { headers: traktHeaders(accessToken, clientId) }
  );
  if (!res.ok) return { airedEpisodes: null, totalEpisodes: null };
  const episodes = await res.json();
  if (!Array.isArray(episodes)) return { airedEpisodes: null, totalEpisodes: null };
  const totalEpisodes = episodes.length;
  const nowTs = Date.now();
  const airedEpisodes = episodes.filter((ep) => {
    const t = new Date(ep?.first_aired || '').getTime();
    return Number.isFinite(t) && t <= nowTs;
  }).length;
  const value = { airedEpisodes, totalEpisodes };
  seasonCache.set(key, { value, expiresAtMs: now + 10 * 60 * 1000 });
  return value;
};

const mapPlaybackItem = async (item, accessToken, clientId) => {
  const showTitle = item?.show?.title || 'Unknown show';
  const episodeTitle = item?.episode?.title || '';
  const slug = item?.show?.ids?.slug || '';
  const season = item?.episode?.season ?? null;
  const number = item?.episode?.number ?? null;
  const progress = Number.isFinite(item?.progress) ? Math.round(item.progress) : 0;
  const updatedAt = item?.paused_at || item?.updated_at || '';
  const [showMeta, seasonStats] = await Promise.all([
    getShowMeta(accessToken, clientId, slug),
    getSeasonStats(accessToken, clientId, slug, season)
  ]);
  const watchedEpisodes = number != null ? number : null;
  const airedEpisodes = seasonStats.airedEpisodes ?? watchedEpisodes;
  const totalEpisodes = seasonStats.totalEpisodes;
  return {
    id: item?.id || `${slug || 'show'}-${season || 0}-${number || 0}`,
    showTitle,
    episodeTitle,
    slug,
    season,
    number,
    progress,
    updatedAt,
    watchedEpisodes,
    airedEpisodes,
    totalEpisodes,
    posterUrl: showMeta.posterUrl,
    url:
      slug && season != null && number != null
        ? `https://trakt.tv/shows/${slug}/seasons/${season}/episodes/${number}`
        : slug
          ? `https://trakt.tv/shows/${slug}`
          : 'https://trakt.tv/'
  };
};

const mapContinueWatchingShow = async (item, accessToken, clientId) => {
  const slug = item?.show?.ids?.slug || '';
  if (!slug) return null;
  const progressRes = await fetch(
    `https://api.trakt.tv/shows/${encodeURIComponent(slug)}/progress/watched?hidden=false&specials=false&count_specials=false`,
    { headers: traktHeaders(accessToken, clientId) }
  );
  if (!progressRes.ok) return null;
  const progress = await progressRes.json();
  const hasNext = Boolean(progress?.next_episode?.season != null && progress?.next_episode?.number != null);
  const watched = Number(progress?.completed ?? 0);
  const aired = Number(progress?.aired ?? 0);
  if (!hasNext && !(Number.isFinite(watched) && Number.isFinite(aired) && watched < aired)) {
    return null;
  }
  const [showMeta, seasonStats] = await Promise.all([
    getShowMeta(accessToken, clientId, slug),
    getSeasonStats(accessToken, clientId, slug, progress?.next_episode?.season ?? null)
  ]);
  const season = progress?.next_episode?.season ?? null;
  const number = progress?.next_episode?.number ?? null;
  return {
    id: `continue-${slug}`,
    showTitle: item?.show?.title || 'Unknown show',
    episodeTitle: progress?.next_episode?.title || '',
    slug,
    season,
    number,
    progress: 0,
    updatedAt: progress?.last_watched_at || item?.last_watched_at || '',
    watchedEpisodes: Number.isFinite(watched) ? watched : null,
    airedEpisodes: seasonStats.airedEpisodes ?? (Number.isFinite(aired) ? aired : null),
    totalEpisodes: showMeta.episodes ?? showMeta.airedEpisodes ?? seasonStats.totalEpisodes,
    posterUrl: showMeta.posterUrl,
    url:
      slug && season != null && number != null
        ? `https://trakt.tv/shows/${slug}/seasons/${season}/episodes/${number}`
        : `https://trakt.tv/shows/${slug}`
  };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const limit = parseLimit(req.query?.limit);
  const now = Date.now();
  if (cooldownUntilMs > now) {
    const retryInSec = Math.max(1, Math.ceil((cooldownUntilMs - now) / 1000));
    res.setHeader('Retry-After', String(retryInSec));
    res.status(429).json({
      error: 'Trakt unavailable',
      stage: 'rate_limited',
      details: `Trakt rate limited. Retry in ${retryInSec}s.`,
      statusCode: 429
    });
    return;
  }

  if (
    Array.isArray(playbackCache.items) &&
    playbackCache.limit === limit &&
    playbackCache.expiresAtMs > now
  ) {
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ items: playbackCache.items });
    return;
  }

  try {
    const { accessToken, clientId } = await getAccessToken();
    const playbackRes = await fetch(TRAKT_PLAYBACK_ENDPOINT, {
      headers: traktHeaders(accessToken, clientId)
    });

    if (!playbackRes.ok) {
      throw createFailure('trakt_api_failed', `Trakt playback fetch failed: ${playbackRes.status}`, playbackRes.status);
    }

    const body = await playbackRes.json();
    const playbackItems = await Promise.all((Array.isArray(body) ? body : []).map((entry) => mapPlaybackItem(entry, accessToken, clientId)));
    const watchedRes = await fetch(TRAKT_WATCHED_SHOWS_ENDPOINT, {
      headers: traktHeaders(accessToken, clientId)
    });
    let continueItems = [];
    if (watchedRes.ok) {
      const watchedBody = await watchedRes.json();
      const watchedShows = (Array.isArray(watchedBody) ? watchedBody : [])
        .sort((a, b) => new Date(b?.last_watched_at || '').getTime() - new Date(a?.last_watched_at || '').getTime())
        .slice(0, MAX_PROGRESS_LOOKUPS);
      continueItems = (await Promise.all(watchedShows.map((entry) => mapContinueWatchingShow(entry, accessToken, clientId)))).filter(Boolean);
    }
    const deduped = new Map();
    for (const entry of [...playbackItems, ...continueItems]) {
      const key = entry?.slug || String(entry?.id || '');
      if (!key || deduped.has(key)) continue;
      deduped.set(key, entry);
    }
    const normalizedItems = Array.from(deduped.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    playbackCache = {
      limit,
      items: normalizedItems,
      expiresAtMs: now + 10 * 60 * 1000
    };

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ items: normalizedItems });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: 'Trakt unavailable',
      stage: error?.stage || 'unknown',
      details: error?.message || 'Unexpected error',
      statusCode
    });
  }
}
