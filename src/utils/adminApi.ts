// Universal Admin API Helper for Guaranteed Persistence Across Vercel Proxies
export const getAdminAuthToken = (): string => {
  if (typeof window === 'undefined') return 'admin-session';
  const saved = localStorage.getItem('wits_lingo_token');
  if (saved && saved !== 'null' && saved !== 'undefined') {
    return saved;
  }
  return 'admin-session';
};

export const setAdminAuthCookie = (token: string): void => {
  if (typeof document === 'undefined') return;
  try {
    const effectiveToken = token || getAdminAuthToken();
    document.cookie = `admin_session_token=${encodeURIComponent(effectiveToken)}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `wits_auth_token=${encodeURIComponent(effectiveToken)}; path=/; max-age=2592000; SameSite=Lax`;
  } catch (e) {
    console.warn('[AdminApi] Could not set auth cookie:', e);
  }
};

export const adminFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const token = getAdminAuthToken();
  setAdminAuthCookie(token);

  // 1. Build Multi-header authentication (bypasses Vercel header stripping)
  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('x-authorization', `Bearer ${token}`);
  headers.set('x-admin-token', token);
  headers.set('x-auth-token', token);
  headers.set('x-access-token', token);

  // 2. Prepare URL with ?token= if relative /api/
  let rawUrl = typeof input === 'string' ? input : input.toString();
  let fullUrl = rawUrl;
  if (rawUrl.startsWith('/api/') || rawUrl.includes('/api/')) {
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.witslingo.com';
      const urlObj = new URL(rawUrl, base);
      if (!urlObj.searchParams.has('token')) {
        urlObj.searchParams.set('token', token);
      }
      fullUrl = urlObj.pathname + urlObj.search;
    } catch {
      const sep = rawUrl.includes('?') ? '&' : '?';
      fullUrl = `${rawUrl}${sep}token=${encodeURIComponent(token)}`;
    }
  }

  // 3. Inject adminToken into JSON body if present
  let body = init.body;
  const contentType = headers.get('Content-Type') || '';
  if (typeof body === 'string' && contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !parsed.adminToken) {
        parsed.adminToken = token;
        body = JSON.stringify(parsed);
      }
    } catch {
      // Keep original body if parsing fails
    }
  }

  return fetch(fullUrl, {
    ...init,
    headers,
    body,
    credentials: 'same-origin'
  });
};
