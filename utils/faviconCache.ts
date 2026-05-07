type CachedFavicon = {
  dataUrl: string;
  cachedAt: number;
  lastAccessedAt: number;
};

const FAVICON_CACHE_KEY = 'tui-favicon-cache-v1';
const MAX_FAVICON_CACHE_ENTRIES = 200;
const FAVICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const now = () => Date.now();

const readCache = (): Record<string, CachedFavicon> => {
  try {
    const raw = localStorage.getItem(FAVICON_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, CachedFavicon>;
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, CachedFavicon>) => {
  localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cache));
};

const pruneCache = (cache: Record<string, CachedFavicon>): Record<string, CachedFavicon> => {
  const t = now();
  const entries = Object.entries(cache).filter(([, v]) => {
    return (
      v &&
      typeof v.dataUrl === 'string' &&
      v.dataUrl.startsWith('data:') &&
      typeof v.cachedAt === 'number' &&
      t - v.cachedAt <= FAVICON_CACHE_TTL_MS
    );
  });

  if (entries.length <= MAX_FAVICON_CACHE_ENTRIES) {
    return Object.fromEntries(entries);
  }

  entries.sort((a, b) => (b[1].lastAccessedAt || 0) - (a[1].lastAccessedAt || 0));
  return Object.fromEntries(entries.slice(0, MAX_FAVICON_CACHE_ENTRIES));
};

export const getCachedFaviconDataUrl = (hostname: string): string | null => {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;

  const cache = pruneCache(readCache());
  const hit = cache[host];
  if (!hit) {
    writeCache(cache);
    return null;
  }

  hit.lastAccessedAt = now();
  cache[host] = hit;
  writeCache(cache);
  return hit.dataUrl;
};

export const setCachedFaviconDataUrl = (hostname: string, dataUrl: string) => {
  const host = hostname.trim().toLowerCase();
  if (!host || !dataUrl.startsWith('data:')) return;
  const cache = pruneCache(readCache());
  cache[host] = {
    dataUrl,
    cachedAt: now(),
    lastAccessedAt: now()
  };
  writeCache(pruneCache(cache));
};

export const clearFaviconCache = () => {
  localStorage.removeItem(FAVICON_CACHE_KEY);
};
