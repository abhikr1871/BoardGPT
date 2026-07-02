import { useEffect, useState } from 'react';
import { getAuth, login, logout, register, type AuthState } from '../lib/auth';
import { loadSettings } from '../lib/storage';
import { syncAll, type SyncAllResult } from '../lib/cloudSync';

/**
 * Account panel (Phase 3). Email/password login & registration against the
 * configured backend, the current logged-in state (email + plan), a Logout
 * button and a "Sync now" action that pushes local data via cloudSync. Falls
 * back to a friendly note when no Backend API URL is configured.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: PANEL,
  color: TEXT,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: ACCENT,
  color: '#0b1120',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export function LoginPage({ onAuthChanged }: { onAuthChanged?: () => void }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [hasBackend, setHasBackend] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null);

  async function refresh() {
    const [state, settings] = await Promise.all([getAuth(), loadSettings()]);
    setAuth(state);
    setHasBackend(!!settings.apiBaseUrl?.trim());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const loggedIn = !!auth?.token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = mode === 'login' ? await login(email, password) : await register(email, password);
      setAuth(next);
      setPassword('');
      onAuthChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    setBusy(true);
    try {
      const next = await logout();
      setAuth(next);
      setSyncResult(null);
      onAuthChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function doSync() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncAll();
    setSyncResult(result);
    setSyncing(false);
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>Account</h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Sign in to sync your games and mistakes across devices.
        </p>

        {!hasBackend && (
          <div
            style={{
              ...card,
              padding: 12,
              marginBottom: 16,
              borderColor: 'rgba(250,204,21,0.35)',
              background: 'rgba(250,204,21,0.08)',
            }}
          >
            <div style={{ fontSize: 12, color: '#fde047' }}>
              No backend configured. Set the <strong>Backend API URL</strong> in Settings to enable
              accounts and cloud sync.
            </div>
          </div>
        )}

        {loggedIn ? (
          <div style={card}>
            <div style={{ fontSize: 12, color: MUTED }}>Signed in as</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{auth?.email ?? 'Account'}</div>
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: auth?.plan === 'premium' ? 'rgba(34,197,94,0.15)' : PANEL,
                  border: `1px solid ${auth?.plan === 'premium' ? 'rgba(34,197,94,0.35)' : BORDER}`,
                  color: auth?.plan === 'premium' ? '#4ade80' : MUTED,
                }}
              >
                {auth?.plan === 'premium' ? '⭐ Premium' : 'Free plan'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={{ ...primaryBtn, flex: 1 }} onClick={() => void doSync()} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button style={ghostBtn} onClick={() => void doLogout()} disabled={busy}>
                Logout
              </button>
            </div>

            {syncResult && (
              <div
                style={{
                  fontSize: 12,
                  marginTop: 12,
                  color: syncResult.ok ? ACCENT : '#f87171',
                }}
              >
                {syncResult.message}
              </div>
            )}
          </div>
        ) : (
          <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['login', 'register'] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${active ? ACCENT : BORDER}`,
                      background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                      color: active ? '#4ade80' : TEXT,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'login' ? 'Login' : 'Register'}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                style={inputStyle}
              />
              <button type="submit" style={primaryBtn} disabled={busy || !hasBackend}>
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>

            {error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
