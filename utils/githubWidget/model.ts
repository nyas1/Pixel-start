/** Map API JSON to list rows and UI helpers (no fetch). */

import type { GitHubItem } from './types';

export const getRepoFromHtmlUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repo) return 'unknown/repo';
    return `${owner}/${repo}`;
  } catch {
    return 'unknown/repo';
  }
};

const MS_PER_MINUTE = 60_000;

export const getRelativeAge = (updatedAt: string): string => {
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const diffMin = Math.max(1, Math.floor(diffMs / MS_PER_MINUTE));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
};

export const mapGithubWorkItem = (item: any): GitHubItem => ({
  id: item.id,
  type: item.type === 'issue' || item.type === 'pr' ? item.type : item.pull_request ? 'pr' : 'issue',
  title: item.title || '(untitled)',
  repo: item.repo || getRepoFromHtmlUrl(item.html_url || ''),
  number: item.number || 0,
  url: item.url || item.html_url || '#',
  updatedAt: item.updatedAt || item.updated_at || ''
});

/** Drop duplicates when the API merges issues + PRs with overlapping keys. */
export const dedupeGithubItems = (merged: GitHubItem[]): GitHubItem[] => {
  const deduped: GitHubItem[] = [];
  const seen = new Set<string>();
  for (const item of merged) {
    const key = `${item.type}:${item.repo}#${item.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
};
