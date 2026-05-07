/** Resolve integration URL and fetch `/api/github-work-items`. */

import { normalizeUserApiOrigin } from '../integrationApiOrigin';
import type { GitHubApiErrorBody, GitHubItem } from './types';
import { dedupeGithubItems, mapGithubWorkItem } from './model';

export const resolveGithubApiUrl = (userBase: string, username: string, limit: number) => {
  const base = normalizeUserApiOrigin(userBase);
  const qs = `username=${encodeURIComponent(username)}&limit=${limit}`;
  const apiPath = `/api/github-work-items?${qs}`;
  if (base) {
    if (/\/api\/github-work-items(?:\?|$)/i.test(base)) {
      const withNoTrailingParams = base
        .replace(/[?&]username=[^&]*/i, '')
        .replace(/[?&]limit=[^&]*/i, '')
        .replace(/[?&]$/, '');
      const joiner = withNoTrailingParams.includes('?') ? '&' : '?';
      return `${withNoTrailingParams}${joiner}${qs}`;
    }
    return `${base}${apiPath}`;
  }
  return apiPath;
};

export const resolveSameOriginGithubApiUrl = (username: string, limit: number) =>
  `/api/github-work-items?username=${encodeURIComponent(username)}&limit=${limit}`;

export async function fetchGithubWorkItems(options: {
  username: string;
  limit: number;
  integrationApiBaseUrl: string;
}): Promise<GitHubItem[]> {
  const { username, limit, integrationApiBaseUrl } = options;
  const isExtension = window.location.protocol === 'moz-extension:';
  const endpoint = resolveGithubApiUrl(integrationApiBaseUrl, username, limit);

  const issuesRes = await (async () => {
    try {
      return await fetch(endpoint, { cache: 'no-store' });
    } catch (err) {
      const isLocalhost = /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname);
      const fallback = resolveSameOriginGithubApiUrl(username, limit);
      if (!isLocalhost || endpoint === fallback) throw err;
      return await fetch(fallback, { cache: 'no-store' });
    }
  })();

  if (!issuesRes.ok) {
    const status = issuesRes.status;
    let parsed: GitHubApiErrorBody | null = null;
    try {
      const body = await issuesRes.json();
      if (body && typeof body === 'object') parsed = body as GitHubApiErrorBody;
    } catch {
      parsed = null;
    }
    if (isExtension && !/^https?:\/\//i.test(integrationApiBaseUrl.trim())) {
      throw new Error('set Integration API base URL in Settings -> Advanced.');
    }
    if (status === 404) throw new Error('no /api route here — set Integration API base URL.');
    if (parsed?.stage === 'missing_env') throw new Error('server missing GITHUB_TOKEN env var.');
    if (parsed?.details) throw new Error(parsed.details);
    throw new Error(`GitHub API route error (${status})`);
  }

  const merged = ((await issuesRes.json())?.items || []).map(mapGithubWorkItem);
  return dedupeGithubItems(merged);
}
