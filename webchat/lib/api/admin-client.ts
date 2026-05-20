/**
 * Admin API client.
 *
 * Provides connection management and a core fetch wrapper for the
 * admin endpoints (/admin/*). Credentials are persisted in localStorage.
 */

import type { AdminConnection } from '@/lib/types/admin';

const STORAGE_URL_KEY = 'hotplex_admin_url';
const STORAGE_TOKEN_KEY = 'hotplex_admin_token';

// ---------------------------------------------------------------------------
// Connection persistence
// ---------------------------------------------------------------------------

export function getStoredAdminConnection(): AdminConnection | null {
  if (typeof window === 'undefined') return null;
  const url = localStorage.getItem(STORAGE_URL_KEY);
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!url || !token) return null;
  return { url, token };
}

export function storeAdminConnection(conn: AdminConnection): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_URL_KEY, conn.url);
  localStorage.setItem(STORAGE_TOKEN_KEY, conn.token);
}

export function clearAdminConnection(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

interface AdminFetchOptions extends RequestInit {
  conn?: AdminConnection;
}

export async function adminFetch<T>(
  path: string,
  options?: AdminFetchOptions,
): Promise<T> {
  const conn = options?.conn ?? getStoredAdminConnection();
  if (!conn) {
    throw new Error('Admin connection not configured');
  }

  const url = `${conn.url}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${conn.token}`,
    'Content-Type': 'application/json',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      ...options,
      headers: options?.headers
        ? { ...headers, ...(options.headers as Record<string, string>) }
        : headers,
      signal: options?.signal ?? controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      clearAdminConnection();
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login?error=session_expired';
      }
      throw new Error('Admin authentication failed (401)');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Admin request failed: ${res.status}`);
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export type TestConnectionResult = {
  ok: boolean;
  type: 'success' | 'network_error' | 'auth_error' | 'other_error';
  error?: string;
};

export async function testConnectionVerbose(conn: AdminConnection): Promise<TestConnectionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${conn.url}/admin/health`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${conn.token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      return { ok: false, type: 'auth_error', error: 'Unauthorized (401)' };
    }
    if (!res.ok) {
      return { ok: false, type: 'other_error', error: `HTTP ${res.status}` };
    }
    return { ok: true, type: 'success' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, type: 'network_error', error: 'Timeout (10s reached)' };
    }
    return { ok: false, type: 'network_error', error: err.message || 'Network unreachable' };
  }
}

export async function testConnection(conn: AdminConnection): Promise<boolean> {
  const res = await testConnectionVerbose(conn);
  return res.ok;
}
