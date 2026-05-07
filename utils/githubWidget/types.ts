/** GitHub work-items widget (integration API). */

export type GitHubItem = {
  id: number;
  type: 'issue' | 'pr';
  title: string;
  repo: string;
  number: number;
  url: string;
  updatedAt: string;
};

export type GitHubWidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: GitHubItem[] };

export type GitHubItemFilter = 'all' | 'issue' | 'pr';

export type GitHubApiErrorBody = {
  error?: string;
  details?: string;
  stage?: string;
};
