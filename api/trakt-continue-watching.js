const TRAKT_TOKEN_ENDPOINT = 'https://api.trakt.tv/oauth/token';
const TRAKT_PLAYBACK_ENDPOINT = 'https://api.trakt.tv/sync/playback/episodes?extended=full,show';
const USER_AGENT = 'TerminalTab/1.0 (+https://github.com/nyas1/terminal-tab)';
const TOKEN_SKEW_SECONDS = 60;

let tokenCache = {
  accessToken: '',
  clientId: '',
  expiresAtMs: 0
};

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
  const clientId = process.env.TRAKT_CLIENT_ID;
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;
  const refreshToken = process.env.TRAKT_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw createFailure('missing_env', 'Missing TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, or TRAKT_REFRESH_TOKEN');
  }
  const redirectUri = process.env.TRAKT_REDIRECT_URI || '';
  return { clientId, clientSecret, refreshToken, redirectUri };
};

const getAccessToken = async () => {
  const { clientId, clientSecret, refreshToken, redirectUri } = getConfig();
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
    refresh_token: refreshToken,
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
    const reason =
      tokenData?.error_description ||
      tokenData?.error ||
      tokenData?.message ||
      (rawText ? rawText.slice(0, 200) : `HTTP ${tokenRes.status}`);
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

  return { accessToken: tokenData.access_token, clientId };
};

const mapPlaybackItem = (item) => {
  const showTitle = item?.show?.title || 'Unknown show';
  const episodeTitle = item?.episode?.title || '';
  const slug = item?.show?.ids?.slug || '';
  const tmdbId = item?.show?.ids?.tmdb || null;
  const season = item?.episode?.season ?? null;
  const number = item?.episode?.number ?? null;
  const progress = Number.isFinite(item?.progress) ? Math.round(item.progress) : 0;
  const updatedAt = item?.paused_at || item?.updated_at || '';
  return {
    id: item?.id || `${slug || 'show'}-${season || 0}-${number || 0}`,
    showTitle,
    episodeTitle,
    slug,
    season,
    number,
    progress,
    updatedAt,
    posterUrl: tmdbId ? `https://image.tmdb.org/t/p/w92/${tmdbId}.jpg` : '',
    url:
      slug && season != null && number != null
        ? `https://trakt.tv/shows/${slug}/seasons/${season}/episodes/${number}`
        : slug
          ? `https://trakt.tv/shows/${slug}`
          : 'https://trakt.tv/'
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

  try {
    const { accessToken, clientId } = await getAccessToken();
    const playbackRes = await fetch(TRAKT_PLAYBACK_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'trakt-api-key': clientId,
        'trakt-api-version': '2'
      }
    });

    if (!playbackRes.ok) {
      throw createFailure('trakt_api_failed', `Trakt playback fetch failed: ${playbackRes.status}`, playbackRes.status);
    }

    const body = await playbackRes.json();
    const items = (Array.isArray(body) ? body : [])
      .map(mapPlaybackItem)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.status(200).json({ items });
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
