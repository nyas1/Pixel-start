/** Open issues + PRs via integration `/api/github-work-items`. */

import React, { useEffect, useMemo, useState } from 'react';
import { GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react';
import { useAppContext } from '../contexts/AppContext';
import { GITHUB_WIDGET_LIMIT_DEFAULT, GITHUB_WIDGET_LIMIT_MAX, GITHUB_WIDGET_POLL_MS } from '../utils/githubWidget/constants';
import { getRelativeAge } from '../utils/githubWidget/model';
import { fetchGithubWorkItems } from '../utils/githubWidget/service';
import type { GitHubItemFilter, GitHubWidgetState } from '../utils/githubWidget/types';

export const GitHubWidget: React.FC = () => {
  const { githubUsername, githubLimit, integrationApiBaseUrl } = useAppContext();
  const [state, setState] = useState<GitHubWidgetState>({ status: 'loading' });
  const [filter, setFilter] = useState<GitHubItemFilter>('all');

  useEffect(() => {
    let alive = true;
    const username = githubUsername.trim().replace(/^@+/, '');

    if (!username) {
      setState({ status: 'error', message: 'GitHub: set username in Settings -> Advanced.' });
      return;
    }
    const fetchItems = async () => {
      try {
        const safeLimit = Number.isFinite(githubLimit)
          ? Math.min(GITHUB_WIDGET_LIMIT_MAX, Math.max(1, Math.floor(githubLimit)))
          : GITHUB_WIDGET_LIMIT_DEFAULT;
        const items = await fetchGithubWorkItems({
          username,
          limit: safeLimit,
          integrationApiBaseUrl
        });
        if (!alive) return;
        setState({ status: 'success', items });
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'unknown error';
        setState({ status: 'error', message: `GitHub: ${msg}` });
      }
    };

    setState({ status: 'loading' });
    fetchItems();
    const timer = window.setInterval(fetchItems, GITHUB_WIDGET_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [integrationApiBaseUrl, githubLimit, githubUsername]);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return <p className="text-xs text-[var(--color-muted,#888888)]">loading...</p>;
    }
    if (state.status === 'error') {
      return <p className="text-xs leading-snug text-[var(--color-muted,#888888)]">{state.message}</p>;
    }
    if (state.items.length === 0) {
      return <p className="text-xs text-[var(--color-muted,#888888)]">No open issues or PRs found for this account.</p>;
    }

    const filteredItems = filter === 'all' ? state.items : state.items.filter((item) => item.type === filter);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {(['all', 'issue', 'pr'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`border px-1.5 py-0.5 text-[10px] font-mono no-radius ${
                filter === option
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              [{option === 'all' ? 'ALL' : option === 'issue' ? 'ISSUES' : 'PRS'}]
            </button>
          ))}
        </div>
        {filteredItems.length === 0 ? (
          <p className="text-xs text-[var(--color-muted,#888888)]">No items for this filter.</p>
        ) : (
          <ul className="space-y-2">
            {filteredItems.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block hover:text-[var(--color-accent)]"
                  title={item.title}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-[var(--color-muted,#888888)]">
                      {item.type === 'pr' ? (
                        <GitPullRequestIcon size={14} className="shrink-0 text-[var(--color-accent)]" />
                      ) : (
                        <IssueOpenedIcon size={14} className="shrink-0 text-[var(--color-accent)]" />
                      )}
                      <span className="truncate">
                        {item.repo} #{item.number}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-muted,#888888)]">{getRelativeAge(item.updatedAt)}</span>
                  </div>
                  <p className="truncate text-xs text-[var(--color-fg,#e0e0e0)]">{item.title}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }, [filter, state]);

  return <div className="h-full overflow-auto pr-1 custom-scrollbar">{content}</div>;
};
