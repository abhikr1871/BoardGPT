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
  monthly: { amount: '₹99', caption: 'per month' },
  yearly: { amount: '₹799', caption: 'per year · save 33%' },
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
          className="relative overflow-hidden"
          style={{
            borderRadius: 24,
            padding: 40,
            marginBottom: 32,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.8) 100%)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Subtle background glow for the hero card */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/20 rounded-full blur-[80px] pointer-events-none" />
          
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(34,197,94,0.15), rgba(6,182,212,0.15))',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#4ade80',
              marginBottom: 16,
              boxShadow: '0 0 12px rgba(34,197,94,0.2)',
            }}
          >
            <span aria-hidden>⭐</span> BoardGPT Premium
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 12px 0' }}>
            <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">Play sharper. </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">Learn faster.</span>
          </h1>
          <p style={{ fontSize: 16, color: '#94a3b8', margin: 0, maxWidth: 540, lineHeight: 1.6 }}>
            Deeper engine analysis, an AI coach, unlimited drills, and cross-device history — all in
            one powerful upgrade.
          </p>
          <div style={{ marginTop: 24, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="px-3 py-1 rounded-full bg-gray-800/50 border border-gray-700">
              Current plan:{' '}
              <span style={{ fontWeight: 800, color: isPremium ? ACCENT : '#f8fafc' }}>
                {auth ? (isPremium ? 'Premium' : 'Free') : '…'}
              </span>
            </span>
            {auth?.email && <span style={{ color: MUTED }}>{auth.email}</span>}
          </div>
        </div>

        {/* Comparison table */}
        <div
          style={{
            background: 'rgba(15,23,42,0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 32,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ textAlign: 'left', padding: '16px 24px', fontWeight: 600, color: '#94a3b8' }}>Feature</th>
                <th style={{ textAlign: 'center', padding: '16px 24px', fontWeight: 600, color: '#94a3b8' }}>Free</th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '16px 24px',
                    fontWeight: 800,
                    color: ACCENT,
                    background: 'rgba(34,197,94,0.05)',
                    borderBottom: '2px solid rgba(34,197,94,0.3)',
                  }}
                >
                  Premium
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr 
                  key={f.name} 
                  style={{ 
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                  }}
                >
                  <td style={{ padding: '16px 24px', color: '#e2e8f0', fontWeight: 500 }}>{f.name}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'center', color: '#64748b' }}>
                    <Cell value={f.free} />
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center', background: 'rgba(34,197,94,0.02)' }}>
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
            background: 'linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.7) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 32,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'inline-flex', gap: 6, marginBottom: 24, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
            {(['monthly', 'yearly'] as Interval[]).map((i) => {
              const active = interval === i;
              return (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: active ? 'linear-gradient(135deg, #16a34a, #059669)' : 'transparent',
                    color: active ? '#ffffff' : '#94a3b8',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    boxShadow: active ? '0 4px 12px rgba(22,163,74,0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {i}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.03em' }}>{PRICE[interval].amount}</span>
            <span style={{ fontSize: 16, color: '#94a3b8', marginLeft: 8 }}>{PRICE[interval].caption}</span>
          </div>

          <button
            onClick={() => void upgrade()}
            disabled={busy || isPremium}
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '16px 24px',
              borderRadius: 14,
              border: 'none',
              background: isPremium 
                ? 'rgba(255,255,255,0.05)' 
                : 'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)',
              color: isPremium ? '#64748b' : '#ffffff',
              fontSize: 16,
              fontWeight: 800,
              cursor: isPremium || busy ? 'default' : 'pointer',
              opacity: busy ? 0.8 : 1,
              boxShadow: isPremium ? 'none' : '0 8px 20px rgba(34,197,94,0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              transform: busy ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseEnter={(e) => {
              if (!isPremium && !busy) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(34,197,94,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isPremium && !busy) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(34,197,94,0.4)';
              }
            }}
          >
            {isPremium ? 'You are on Premium' : busy ? 'Starting checkout…' : 'Upgrade to Premium'}
          </button>

          {message && <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginTop: 16 }}>{message}</div>}
          {error && <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginTop: 16 }}>{error}</div>}

          <p style={{ fontSize: 12, color: '#64748b', marginTop: 20, textAlign: 'center' }}>
            🔒 Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
