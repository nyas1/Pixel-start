/** Strip trailing slashes; default scheme to https so the host is not treated as a relative path. */

export function normalizeUserApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, '');
}
