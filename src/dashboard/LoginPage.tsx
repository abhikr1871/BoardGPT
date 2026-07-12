import { useEffect, useState } from 'react';
import { getAuth, login, logout, register, type AuthState } from '../lib/auth';
import { loadSettings } from '../lib/storage';
import { syncAll, type SyncAllResult } from '../lib/cloudSync';

/**
 * Account experience (Phase: Login Redesign). A full-page, glassmorphic
 * split-screen: the LEFT panel carries the auth form (or the signed-in account
 * state), while the RIGHT panel is a feature-highlight showcase. Everything is
 * inline-styled to match the rest of the dashboard (no Tailwind), degrades
 * gracefully with no backend configured, and never blocks the UI.
 */

const ACCENT = '#22c55e';
const ACCENT_LIGHT = '#4ade80';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: 'rgba(15,23,42,0.6)',
  color: TEXT,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})`,
  color: '#0b1120',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 8px 24px -8px rgba(34,197,94,0.6)',
  transition: 'transform 100ms ease, opacity 120ms ease',
};

const ghostBtn: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Multicolor Google "G" logo (inline, no external asset). */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface Highlight {
  icon: string;
  title: string;
  body: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: '⚡',
    title: 'Stockfish 18 depth analysis',
    body: 'World-class engine evaluation on every position, right in your browser.',
  },
  {
    icon: '🟢🔵🔴',
    title: 'Multi-arrow guidance',
    body: 'See the best, alternative and trap lines drawn straight on the board.',
  },
  {
    icon: '🧠',
    title: 'AI coaching',
    body: 'Plain-language explanations of the plans behind each critical move.',
  },
  {
    icon: '🩺',
    title: 'Personal mistake clinic',
    body: 'Turns your blunders into targeted drills so the leak never reopens.',
  },
  {
    icon: '☁️',
    title: 'Cloud sync across devices',
    body: 'Your games and drills follow you everywhere you sign in.',
  },
];

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
  const [googleNote, setGoogleNote] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  async function refresh() {
    const [state, settings] = await Promise.all([getAuth(), loadSettings()]);
    setAuth(state);
    setHasBackend(!!settings.apiBaseUrl?.trim());
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Track viewport width so the split screen stacks on narrow screens. Inline
  // styles can't hold media queries, so we mirror the breakpoint into state.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 880px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const loggedIn = !!auth?.token;
  const isPremium = auth?.plan === 'premium';

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

  function handleGoogle() {
    setGoogleNote(true);
  }

  const glass: React.CSSProperties = {
    background: 'rgba(17,24,39,0.55)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: 16,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 20px 60px -30px rgba(0,0,0,0.8)',
  };

  return (
    <div
      style={{
        color: TEXT,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        width: '100%',
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: narrow ? 12 : 24,
      }}
    >
      <div
        style={{
          ...glass,
          width: '100%',
          maxWidth: 1080,
          minHeight: narrow ? undefined : '70vh',
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          overflow: 'hidden',
        }}
      >
        {/* LEFT: auth form / account state */}
        <div
          style={{
            flex: narrow ? 'unset' : '1 1 46%',
            padding: narrow ? '28px 22px' : '48px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'rgba(11,17,32,0.35)',
          }}
        >
          <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
            {/* Brand lockup */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})`,
                  color: '#0b1120',
                  fontSize: 22,
                  boxShadow: '0 10px 26px -10px rgba(34,197,94,0.75)',
                }}
              >
                ♟
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>BoardGPT</span>
            </div>

            {loggedIn ? (
              <>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px 0' }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px 0' }}>
                  You're signed in. Your games and mistakes can sync across devices.
                </p>

                <div
                  style={{
                    ...glass,
                    borderRadius: 14,
                    padding: 20,
                    background: 'rgba(15,23,42,0.55)',
                  }}
                >
                  <div style={{ fontSize: 12, color: MUTED }}>Signed in as</div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      marginTop: 3,
                      wordBreak: 'break-all',
                    }}
                  >
                    {auth?.email ?? 'Account'}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: isPremium ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.1)',
                        border: `1px solid ${isPremium ? 'rgba(34,197,94,0.4)' : BORDER}`,
                        color: isPremium ? ACCENT_LIGHT : MUTED,
                      }}
                    >
                      {isPremium ? '⭐ PREMIUM' : 'FREE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                      style={{ ...primaryBtn, flex: 1, opacity: syncing ? 0.7 : 1 }}
                      onClick={() => void doSync()}
                      disabled={syncing}
                    >
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
                        marginTop: 14,
                        color: syncResult.ok ? ACCENT_LIGHT : '#f87171',
                      }}
                    >
                      {syncResult.message}
                    </div>
                  )}
                </div>

                {!hasBackend && (
                  <div style={{ fontSize: 11.5, color: '#fde047', marginTop: 14, lineHeight: 1.5 }}>
                    Tip: set a <strong>Backend API URL</strong> in extension Settings so sync has
                    somewhere to send your data.
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px 0' }}>
                  {mode === 'login' ? 'Sign in' : 'Create your account'}
                </h1>
                <p style={{ fontSize: 13, color: MUTED, margin: '0 0 22px 0' }}>
                  {mode === 'login'
                    ? 'Welcome back — pick up right where you left off.'
                    : 'Join BoardGPT and start turning blunders into brilliancies.'}
                </p>


                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    style={{
                      ...inputStyle,
                      borderColor: focused === 'email' ? ACCENT : BORDER,
                      boxShadow: focused === 'email' ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                    }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    style={{
                      ...inputStyle,
                      borderColor: focused === 'password' ? ACCENT : BORDER,
                      boxShadow: focused === 'password' ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      ...primaryBtn,
                      marginTop: 2,
                      opacity: busy || !hasBackend ? 0.7 : 1,
                      cursor: busy || !hasBackend ? 'not-allowed' : 'pointer',
                    }}
                    disabled={busy || !hasBackend}
                  >
                    {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                  </button>
                </form>

                {error && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#f87171',
                      marginTop: 12,
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ fontSize: 13, color: MUTED, marginTop: 18, textAlign: 'center' }}>
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setError(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: ACCENT_LIGHT,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {mode === 'login' ? 'Create one' : 'Sign in'}
                  </button>
                </div>

                {!hasBackend && (
                  <div style={{ fontSize: 11.5, color: '#fde047', marginTop: 16, lineHeight: 1.5 }}>
                    Heads up: set a <strong>Backend API URL</strong> in extension Settings for
                    accounts to work.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: feature showcase */}
        <div
          style={{
            flex: narrow ? 'unset' : '1 1 54%',
            position: 'relative',
            padding: narrow ? '30px 22px' : '48px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            background:
              'radial-gradient(1200px 500px at 100% 0%, rgba(34,197,94,0.22), transparent 55%),' +
              'radial-gradient(900px 500px at 0% 100%, rgba(16,185,129,0.16), transparent 55%),' +
              'linear-gradient(135deg, #0b3b23 0%, #0a2e2a 45%, #06121f 100%)',
          }}
        >
          {/* Soft decorative glow */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(74,222,128,0.35), transparent 70%)',
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', maxWidth: 460 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: ACCENT_LIGHT,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.35)',
                borderRadius: 999,
                padding: '5px 12px',
                marginBottom: 16,
              }}
            >
              ♟ Your chess co-pilot
            </div>

            <h2
              style={{
                fontSize: narrow ? 24 : 30,
                lineHeight: 1.15,
                fontWeight: 800,
                margin: '0 0 10px 0',
                background: `linear-gradient(120deg, #ffffff, ${ACCENT_LIGHT})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: '#ffffff',
              }}
            >
              Play sharper. Learn faster.
            </h2>
            <p style={{ fontSize: 13.5, color: 'rgba(226,232,240,0.8)', margin: '0 0 24px 0', lineHeight: 1.55 }}>
              Everything you need to understand your games — powered by a world-class engine and
              coaching that speaks human.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.title}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      lineHeight: '1.2',
                      flexShrink: 0,
                      minWidth: 26,
                      textAlign: 'center',
                    }}
                  >
                    {h.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{h.title}</div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'rgba(203,213,225,0.78)',
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      {h.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
