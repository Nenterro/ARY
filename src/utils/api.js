/**
 * Centralized Backend API Fetch Utility
 *
 * Tries candidate backend URLs in priority order:
 *   1. Custom URL from localStorage ("ary_custom_backend_url")
 *   2. DuckDNS  (https://huz-ary.duckdns.org:8888)
 *   3. LAN      (http://192.168.18.49:8010)
 *
 * Note: when this app is served over HTTPS from Vercel, the browser blocks the
 * plain-http LAN candidate as mixed content, so that fallback only works when
 * the app is opened over http on the local network. The DuckDNS hostname needs
 * a proxy host in Nginx Proxy Manager before it resolves -- see CLAUDE.local.md.
 *
 * Caches the last-working URL for the session to avoid redundant probing, and
 * attaches the API token (if one is configured) to every request.
 */

const DEFAULT_URLS = [
  'https://huz-ary.duckdns.org:8888',
  'http://192.168.18.49:8010'
];

let cachedWorkingUrl = null;

const TOKEN_KEY = 'ary_api_token';
const CUSTOM_URL_KEY = 'ary_custom_backend_url';

/**
 * Token required by the backend when ARY_API_TOKEN is set on the server.
 * The deployed backend leaves it empty, so this is normally unused.
 */
export function getApiToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setApiToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) */
  }
}

export function getCustomUrl() {
  try {
    return localStorage.getItem(CUSTOM_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomUrl(url) {
  try {
    if (url) localStorage.setItem(CUSTOM_URL_KEY, url.replace(/\/+$/, ''));
    else localStorage.removeItem(CUSTOM_URL_KEY);
  } catch {
    /* storage unavailable */
  }
  cachedWorkingUrl = null;
}

function withAuthHeaders(options) {
  const token = getApiToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['X-ARY-Token'] = token;
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return { ...options, headers };
}

export function getCandidateUrls() {
  const custom = getCustomUrl();
  return [...new Set([custom, ...DEFAULT_URLS].filter(Boolean))];
}

async function attempt(baseUrl, endpoint, fetchOpts, timeout) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...fetchOpts,
    signal: fetchOpts.signal || AbortSignal.timeout(timeout)
  });
  if (!res.ok) {
    // Surface the backend's own error text rather than a bare status code.
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* not json */
    }
    const err = new Error(detail);
    err.status = res.status;
    err.reachedBackend = true;
    throw err;
  }
  return res.json();
}

/**
 * Fetch JSON from the backend API, trying candidate URLs in order.
 * Caches the first working URL for subsequent calls.
 *
 * @param {string} endpoint - API endpoint path (e.g. '/api/catalog')
 * @param {object} options  - Optional fetch options (method, body, signal, timeout)
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If all candidate URLs fail
 */
export async function fetchFromBackend(endpoint, options = {}) {
  const { timeout = 15000, ...rest } = options;
  const fetchOpts = withAuthHeaders(rest);

  if (cachedWorkingUrl) {
    try {
      return await attempt(cachedWorkingUrl, endpoint, fetchOpts, timeout);
    } catch (err) {
      // A real backend error (404, 400) is the answer, not a reason to re-probe.
      if (err.reachedBackend) throw err;
      cachedWorkingUrl = null;
    }
  }

  let lastError = null;
  for (const baseUrl of getCandidateUrls()) {
    try {
      const data = await attempt(baseUrl, endpoint, fetchOpts, timeout);
      cachedWorkingUrl = baseUrl;
      return data;
    } catch (err) {
      if (err.reachedBackend) {
        cachedWorkingUrl = baseUrl;
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('All backend URLs unreachable');
}

/** Convenience wrappers. */
export const apiGet = (endpoint, options) => fetchFromBackend(endpoint, options);

export const apiPost = (endpoint, body, options = {}) =>
  fetchFromBackend(endpoint, {
    ...options,
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  });

export const apiDelete = (endpoint, options = {}) =>
  fetchFromBackend(endpoint, { ...options, method: 'DELETE' });

export function resetCachedUrl() {
  cachedWorkingUrl = null;
}

export function getCachedUrl() {
  return cachedWorkingUrl;
}

export { DEFAULT_URLS };
