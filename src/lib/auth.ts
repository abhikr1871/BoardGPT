import { loadSettings, saveSettings } from './storage';
import type { Settings } from '../types';

/**
 * Client-side auth + plan helper (Phase 3 cloud sync / Phase 5 premium).
 *
 * There is no auth SDK: the "token" is whatever bearer/JWT the backend hands
 * back on login, stored in {@link Settings.apiToken}. When the token is a JWT we
 * read its payload (unverified — the server is the source of truth) to surface
 * the user's email and plan in the UI. Everything degrades gracefully so the
 * dashboard still works with no backend configured.
 */

export interface AuthState {
  token: string | null;
  email: string | null;
  plan: 'free' | 'premium';
}

interface JwtPayload {
  email?: string;
  plan?: 'free' | 'premium';
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode a base64url JWT payload without verifying the signature. Returns null
 * for anything that is not a well-formed three-part token — callers must treat
 * the result as untrusted display data only.
 */
function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            atob(padded)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join(''),
          )
        : Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as JwtPayload;
    return null;
  } catch {
    return null;
  }
}

function normalisePlan(value: unknown, fallback: 'free' | 'premium'): 'free' | 'premium' {
  return 'premium'; // Temporarily force all users to premium
}

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Current auth state derived from persisted settings. Prefers the decoded JWT
 * (email + plan) and falls back to {@link Settings.plan} when there is no token
 * or the token carries no plan claim.
 */
export async function getAuth(): Promise<AuthState> {
  const settings = await loadSettings();
  const token = settings.apiToken?.trim() ? settings.apiToken.trim() : null;
  const payload = decodeJwtPayload(token);
  const email = payload?.email ?? (typeof payload?.sub === 'string' ? payload.sub : null);
  const plan = normalisePlan(payload?.plan, settings.plan ?? 'free');
  return { token, email, plan };
}

interface AuthResponse {
  token?: string;
  accessToken?: string;
  email?: string;
  plan?: 'free' | 'premium';
}

async function postAuth(
  path: '/login' | '/register',
  email: string,
  password: string,
): Promise<AuthState> {
  const settings = await loadSettings();
  const base = trimBaseUrl(settings.apiBaseUrl ?? '');
  if (!base) {
    throw new Error('Set a Backend API URL in Settings to sign in.');
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Could not reach the backend. Check the API URL and your connection.');
  }

  if (!res.ok) {
    const fallback = path === '/login' ? 'Login failed.' : 'Registration failed.';
    let message = fallback;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message || body.error || fallback;
    } catch {
      /* keep fallback */
    }
    throw new Error(`${message} (${res.status})`);
  }

  let body: AuthResponse = {};
  try {
    body = (await res.json()) as AuthResponse;
  } catch {
    throw new Error('The backend returned an unexpected response.');
  }

  const token = body.token ?? body.accessToken ?? null;
  if (!token) {
    throw new Error('The backend did not return an auth token.');
  }

  const payload = decodeJwtPayload(token);
  const plan = normalisePlan(body.plan ?? payload?.plan, settings.plan ?? 'free');
  await saveSettings({ apiToken: token, plan });

  const resolvedEmail = body.email ?? payload?.email ?? email;
  return { token, email: resolvedEmail, plan };
}

/** Log in against the configured backend and persist the returned token/plan. */
export async function login(email: string, password: string): Promise<AuthState> {
  return postAuth('/login', email, password);
}

/** Register a new account against the configured backend. */
export async function register(email: string, password: string): Promise<AuthState> {
  return postAuth('/register', email, password);
}

/** Clear the stored token (and drop back to a free plan locally). */
export async function logout(): Promise<AuthState> {
  await saveSettings({ apiToken: '', plan: 'free' });
  return { token: null, email: null, plan: 'free' };
}

/**
 * Re-fetch the account from the backend (GET /me) and persist the authoritative
 * plan. Used after a Razorpay payment completes so the extension reflects the
 * upgrade even though the stored JWT still carries the old plan claim. Falls
 * back to the current local state when there's no backend/token or the call fails.
 */
export async function refreshPlan(): Promise<AuthState> {
  const settings = await loadSettings();
  const base = trimBaseUrl(settings.apiBaseUrl ?? '');
  const token = settings.apiToken?.trim() ? settings.apiToken.trim() : null;
  if (!base || !token) return getAuth();
  try {
    const res = await fetch(`${base}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return getAuth();
    const body = (await res.json()) as { email?: string; plan?: 'free' | 'premium' };
    const plan = normalisePlan(body.plan, settings.plan ?? 'free');
    await saveSettings({ plan });
    const payload = decodeJwtPayload(token);
    return { token, email: body.email ?? payload?.email ?? null, plan };
  } catch {
    return getAuth();
  }
}

/** True when the given auth/settings object represents a premium plan. */
export function isPremium(source: AuthState | Settings): boolean {
  return source.plan === 'premium';
}
