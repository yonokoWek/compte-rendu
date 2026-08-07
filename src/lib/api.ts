/**
 * Authenticated fetch wrapper with offline support.
 * Automatically injects the Bearer token from localStorage into all API requests.
 * When offline, POST/DELETE/PUT requests are queued for later sync.
 * All frontend API calls should use this instead of native fetch.
 */
import { offlineAwareFetch } from '@/lib/offline-sync';

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cr_session_token') : null;
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return offlineAwareFetch(url, { ...options, headers });
}

/**
 * Get auth headers object for use with other libraries.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cr_session_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}
