/**
 * Supabase email links (confirmation, password recovery, magic link) redirect
 * back into the app with the tokens in the URL *fragment* (after `#`), e.g.
 *   gainz:///#access_token=…&refresh_token=…&type=recovery
 * expo-router doesn't surface the fragment, so we parse it ourselves.
 */
export interface AuthLinkParams {
  access_token: string;
  refresh_token: string;
  type: string | null;
}

export function parseAuthParams(url: string): AuthLinkParams | null {
  // Tokens live after `#`, but fall back to the query string just in case.
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const raw =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token, type: params.get('type') };
}
