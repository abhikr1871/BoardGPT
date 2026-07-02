import type { EngineLine } from '../types';
import { bandForCp, formatEval, cpToBarFraction } from '../lib/evaluation';

const PILL_STYLE: Record<string, { background: string; color: string; shadow: string }> = {
  BEST: { background: 'linear-gradient(90deg,#16a34a,#22c55e)', color: '#000', shadow: '0 2px 8px rgba(34,197,94,0.35)' },
  GOOD: { background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)', color: '#fff', shadow: '0 2px 8px rgba(59,130,246,0.3)' },
  EQUAL: { background: 'linear-gradient(90deg,#374151,#4b5563)', color: '#e5e7eb', shadow: 'none' },
};

interface Props {
  line: EngineLine;
  /** whose move it is, to tint the eval band correctly (white POV cp). */
  turn: 'w' | 'b';
}

/** A single move suggestion card (blueprint §7 Move Card UI). */
export function MoveCard({ line, turn }: Props) {
  const whiteCp = turn === 'w' ? line.cp : -line.cp;
  const band = bandForCp(whiteCp);
  const frac = cpToBarFraction(whiteCp);
  const pill = PILL_STYLE[line.label] ?? PILL_STYLE.EQUAL;

  return (
    <div
      style={{
        borderRadius: 10,
        background: 'linear-gradient(135deg, #0f1d2e 0%, #111827 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '10px 12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      {/* Top row: move + pill + eval */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 800,
              fontSize: 16,
              color: '#4ade80',
              letterSpacing: '0.02em',
            }}
          >
            {line.san}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 20,
              letterSpacing: '0.06em',
              background: pill.background,
              color: pill.color,
              boxShadow: pill.shadow,
            }}
          >
            {line.label}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            color: band.color,
          }}
        >
          {formatEval(line.cp, line.mate)}
        </span>
      </div>

      {/* Eval progress bar */}
      <div
        style={{
          height: 3,
          width: '100%',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          marginBottom: line.explanation ? 8 : 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${frac * 100}%`,
            background: `linear-gradient(90deg, ${band.color}99, ${band.color})`,
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Explanation text */}
      {line.explanation && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: '#9ca3af',
            margin: 0,
          }}
        >
          {line.explanation}
        </p>
      )}
    </div>
  );
}

