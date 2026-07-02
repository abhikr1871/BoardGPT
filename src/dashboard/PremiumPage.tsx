import { useEffect, useState } from 'react';
import { getAuth, type AuthState } from '../lib/auth';
import { loadSettings } from '../lib/storage';

/**
 * The upgrade page (Phase 5). Shows a Free vs Premium comparison from the
 * roadmap feature table, monthly/yearly pricing, and an Upgrade button that
 * kicks off Stripe Checkout via the backend when one is configured.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

type Interval = 'monthly' | 'yearly';

interface FeatureRow {
  name: string;
  free: string | boolean;
  premium: string | boolean;
}

const FEATURES: FeatureRow[] = [
  { name: 'Stockfish analysis depth', free: 'Depth 12', premium: 'Depth 18' },
  { name: 'Board arrows', free: 'Best move only', premium: 'Multi-arrows' },
  { name: 'AI coach explanations', free: false, premium: true },
  { name: 'Opening repertoire', free: '5 openings', premium: '50+ openings' },
  { name: 'Mistake Clinic', free: 'Limited', premium: 'Unlimited' },
  { name: 'Cloud game history', free: false, premium: true },
  { name: 'Masterclasses', free: 'Preview', premium: 'Full library' },
  { name: 'Blunder shield', free: false, premium: true },
  { name: 'Overlay themes', free: '1 theme', premium: 'All themes' },
  { name: 'Cross-device sync', free: false, premium: true },
];

const PRICE: Record<Interval, { amount: string; caption: string }> = {
  monthly: { amount: '$4.99', caption: 'per month' },
  yearly: { amount: '$39.99', caption: 'per year · save 33%' },
};

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function Cell({ value }: { value: string | boolean; strong?: boolean }) {
  if (value === true) return <span style={{ color: ACCENT, fontWeight: 700 }}>✓</span>;
  if (value === false) return <span style={{ color: '#6b7280' }}>—</span>;
  return <span>{value}</span>;
}

export function PremiumPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [interval, setInterval] = useState<Interval>('yearly');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuth().then(setAuth).catch(() => {});
  }, []);

  const isPremium = auth?.plan === 'premium';

  async function upgrade() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const settings = await loadSettings();
      const base = trimBaseUrl(settings.apiBaseUrl ?? '');
      if (!base) {
        setError('A backend must be configured to process payments. Set the Backend API URL in Settings.');
        return;
      }
      const res = await fetch(`${base}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiToken?.trim()
            ? { Authorization: `Bearer ${settings.apiToken.trim()}` }
            : {}),
        },
        body: JSON.stringify({ interval }),
      });
      if (!res.ok) {
        setError(`Could not start checkout (server responded ${res.status}).`);
        return;
      }
      const body = (await res.json()) as { url?: string; checkoutUrl?: string };
      const url = body.url ?? body.checkoutUrl;
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener');
        setMessage('Opening secure Stripe checkout in a new tab…');
      } else {
        setError('The backend did not return a checkout URL.');
      }
    } catch (e) {
      setError((e as Error).message || 'Something went wrong starting checkout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        {/* Hero */}
        <div
          style={{
            borderRadius: 14,
            padding: 24,
            marginBottom: 20,
            background:
              'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,211,238,0.12) 60%, rgba(15,23,42,0.4))',
            border: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(34,197,94,0.2)',
              border: '1px solid rgba(34,197,94,0.4)',
              color: '#4ade80',
              marginBottom: 10,
            }}
          >
            <span aria-hidden>⭐</span> BoardGPT Premium
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px 0' }}>
            Play sharper. Learn faster.
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, maxWidth: 480, lineHeight: 1.5 }}>
            Deeper engine analysis, an AI coach, unlimited drills and cross-device history — all in
            one upgrade.
          </p>
          <div style={{ marginTop: 14, fontSize: 13 }}>
            Current plan:{' '}
            <span style={{ fontWeight: 700, color: isPremium ? ACCENT : MUTED }}>
              {auth ? (isPremium ? 'Premium' : 'Free') : '…'}
            </span>
            {auth?.email && <span style={{ color: MUTED }}> · {auth.email}</span>}
          </div>
        </div>

        {/* Comparison table */}
        <div
          style={{
            background: PANEL_ALT,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: PANEL, color: MUTED }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Feature</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600 }}>Free</th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 14px',
                    fontWeight: 700,
                    color: ACCENT,
                  }}
                >
                  Premium
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.name} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '10px 14px', color: TEXT }}>{f.name}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: MUTED }}>
                    <Cell value={f.free} />
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <Cell value={f.premium} strong />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing */}
        <div
          style={{
            background: PANEL_ALT,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['monthly', 'yearly'] as Interval[]).map((i) => {
              const active = interval === i;
              return (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: active ? '#4ade80' : TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {i}
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 34, fontWeight: 800 }}>{PRICE[interval].amount}</span>{' '}
            <span style={{ fontSize: 13, color: MUTED }}>{PRICE[interval].caption}</span>
          </div>

          <button
            onClick={() => void upgrade()}
            disabled={busy || isPremium}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: isPremium ? '#1f2937' : ACCENT,
              color: isPremium ? MUTED : '#0b1120',
              fontSize: 15,
              fontWeight: 800,
              cursor: isPremium || busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {isPremium ? 'You are on Premium' : busy ? 'Starting checkout…' : 'Upgrade to Premium'}
          </button>

          {message && <div style={{ fontSize: 12, color: ACCENT, marginTop: 12 }}>{message}</div>}
          {error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{error}</div>}

          <p style={{ fontSize: 11, color: MUTED, marginTop: 14, textAlign: 'center' }}>
            Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
