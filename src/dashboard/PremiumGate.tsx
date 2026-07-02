import type { ReactNode } from 'react';

/**
 * Wraps a premium-only feature. When the user is on the premium plan the
 * children render as-is; otherwise a tasteful, non-aggressive locked card is
 * shown with an Upgrade button. `onUpgrade` lets the host navigate to the
 * Premium tab; without it the button falls back to a `#premium` hash so it
 * still does something sensible.
 */

const ACCENT = '#22c55e';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

export function PremiumGate({
  feature,
  premium,
  children,
  onUpgrade,
}: {
  feature: string;
  premium: boolean;
  children: ReactNode;
  onUpgrade?: () => void;
}) {
  if (premium) return <>{children}</>;

  function handleUpgrade() {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        window.location.hash = 'premium';
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      style={{
        background: PANEL_ALT,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        color: TEXT,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
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
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.35)',
          color: '#4ade80',
          marginBottom: 12,
        }}
      >
        <span aria-hidden>⭐</span> Premium
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{feature}</div>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 auto 16px', maxWidth: 360, lineHeight: 1.5 }}>
        This is a premium feature. Upgrade to unlock {feature.toLowerCase()} along with the rest of
        the BoardGPT Premium toolkit.
      </p>

      <button
        onClick={handleUpgrade}
        style={{
          padding: '9px 18px',
          borderRadius: 8,
          border: 'none',
          background: ACCENT,
          color: '#0b1120',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Upgrade
      </button>
    </div>
  );
}
