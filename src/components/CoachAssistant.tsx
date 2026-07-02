import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult } from '../types';

/* ─── Heuristic coaching engine ─────────────────────────────────────── */

function getCoaching(
  a: AnalysisResult,
  lastMove: string | null,
  turn: 'w' | 'b' | null,
): { opponent: string; you: string } {
  const cp = Math.round(a.evaluation * 100);
  const phase = a.gamePhase;
  const bestSan = a.moves[0]?.san ?? '…';
  const bestExplain = a.moves[0]?.explanation ?? '';
  const isWhiteTurn = (turn ?? a.turn) === 'w';
  const oppColor = isWhiteTurn ? 'Black' : 'White';

  // ── What is opponent trying to do? ──
  let opponent = '';
  if (Math.abs(cp) < 30) {
    opponent = `${oppColor} is playing for equality — likely probing for a positional weakness or waiting to see your plan.`;
  } else if (cp < -200) {
    opponent = `${oppColor} is pressing hard for a win. They have a clear advantage and are trying to convert it before you can equalise.`;
  } else if (cp < -60) {
    opponent = `${oppColor} has a slight edge and is looking to expand — possibly targeting your king side or weak pawns.`;
  } else if (cp > 200) {
    opponent = `${oppColor} is under pressure and may try a desperate counter-attack or simplify into a drawish endgame.`;
  } else if (cp > 60) {
    opponent = `${oppColor} is fighting back — watch out for tactical tricks or piece activity to generate counter-play.`;
  } else {
    opponent = `${oppColor} is trying to hold the balance and avoid immediate threats.`;
  }

  if (phase === 'opening') {
    opponent = `${oppColor} is still in the opening — likely developing pieces and fighting for central control.`;
  } else if (phase === 'endgame') {
    opponent = `${oppColor} is in endgame mode — the fight is about king activity and pawn promotion.`;
  }

  if (lastMove) {
    opponent += ` Their last move (${lastMove}) signals this intent.`;
  }

  // ── What should you do? ──
  let you = '';
  if (bestExplain) {
    you = `Play **${bestSan}** — ${bestExplain}`;
  } else {
    you = `Your best reply is **${bestSan}**.`;
  }

  if (phase === 'opening') {
    you += ' Focus on development and king safety.';
  } else if (phase === 'middlegame') {
    you += ' Look for tactics and piece coordination.';
  } else {
    you += ' Activate your king and push passed pawns.';
  }

  return { opponent, you };
}

/* ─── Typewriter hook ────────────────────────────────────────────────── */

function useTypewriter(text: string, speed = 22): string {
  const [displayed, setDisplayed] = useState('');
  const prevText = useRef('');

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

/* ─── Animated avatar ────────────────────────────────────────────────── */

function Avatar({ speaking }: { speaking: boolean }) {
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(0); // 0-3 mouth frame

  // Random blink
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 2800 + Math.random() * 1400);
    return () => clearInterval(id);
  }, []);

  // Mouth animation while speaking
  useEffect(() => {
    if (!speaking) { setMouth(0); return; }
    const id = setInterval(() => setMouth((m) => (m + 1) % 4), 140);
    return () => clearInterval(id);
  }, [speaking]);

  const mouthH = [2, 5, 7, 5][mouth];

  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.5))' }}
    >
      {/* Glow ring */}
      <circle cx="26" cy="26" r="25" fill="none" stroke="rgba(34,197,94,0.25)" strokeWidth="1.5" />

      {/* Head */}
      <circle cx="26" cy="26" r="20" fill="#0f1d2e" stroke="#22c55e" strokeWidth="1.5" />

      {/* Circuit lines decoration */}
      <line x1="6" y1="26" x2="14" y2="26" stroke="#22c55e" strokeWidth="0.8" opacity="0.5" />
      <line x1="38" y1="26" x2="46" y2="26" stroke="#22c55e" strokeWidth="0.8" opacity="0.5" />
      <line x1="26" y1="6" x2="26" y2="10" stroke="#22c55e" strokeWidth="0.8" opacity="0.5" />
      <circle cx="26" cy="8" r="1.5" fill="#22c55e" opacity="0.6" />

      {/* Eyes */}
      {blink ? (
        <>
          <rect x="18" y="21" width="5" height="1.5" rx="1" fill="#4ade80" />
          <rect x="29" y="21" width="5" height="1.5" rx="1" fill="#4ade80" />
        </>
      ) : (
        <>
          <ellipse cx="21" cy="22" rx="3" ry="3.5" fill="#0f1d2e" stroke="#4ade80" strokeWidth="1.2" />
          <ellipse cx="31" cy="22" rx="3" ry="3.5" fill="#0f1d2e" stroke="#4ade80" strokeWidth="1.2" />
          <circle cx="22" cy="21.5" r="1.2" fill="#4ade80" />
          <circle cx="32" cy="21.5" r="1.2" fill="#4ade80" />
          {/* Eye shine */}
          <circle cx="22.8" cy="20.8" r="0.5" fill="white" opacity="0.7" />
          <circle cx="32.8" cy="20.8" r="0.5" fill="white" opacity="0.7" />
        </>
      )}

      {/* Mouth */}
      <rect
        x={22}
        y={29}
        width={8}
        height={mouthH}
        rx={2}
        fill="#4ade80"
        opacity={0.85}
        style={{ transition: 'height 0.1s ease' }}
      />

      {/* Antenna */}
      <line x1="26" y1="6" x2="26" y2="11" stroke="#22c55e" strokeWidth="1.2" />
      <circle cx="26" cy="5.5" r="2" fill="#4ade80">
        {speaking && (
          <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Side bolts */}
      <rect x="5" y="22" width="3" height="8" rx="1.5" fill="#1a2233" stroke="#22c55e" strokeWidth="0.8" />
      <rect x="44" y="22" width="3" height="8" rx="1.5" fill="#1a2233" stroke="#22c55e" strokeWidth="0.8" />
    </svg>
  );
}

/* ─── Bold text renderer ─────────────────────────────────────────────── */

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} style={{ color: '#4ade80', fontWeight: 700 }}>
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

interface Props {
  analysis: AnalysisResult;
  lastMove: string | null;
  turn: 'w' | 'b' | null;
  analyzing: boolean;
}

export function CoachAssistant({ analysis, lastMove, turn, analyzing }: Props) {
  const [tab, setTab] = useState<'opponent' | 'you'>('opponent');
  const coaching = getCoaching(analysis, lastMove, turn);
  const activeText = tab === 'opponent' ? coaching.opponent : coaching.you;
  const displayed = useTypewriter(activeText, 18);
  const isSpeaking = displayed.length < activeText.length;

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 12,
        background: 'linear-gradient(135deg, #0a1a10 0%, #0d1520 60%, #0a1520 100%)',
        border: '1px solid rgba(34,197,94,0.25)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(34,197,94,0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px 6px',
          borderBottom: '1px solid rgba(34,197,94,0.12)',
          background: 'rgba(34,197,94,0.04)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: '0.08em' }}>
          ✦ AI COACH
        </span>
        {analyzing && (
          <span
            style={{
              fontSize: 9,
              color: '#22c55e',
              padding: '1px 6px',
              borderRadius: 10,
              border: '1px solid rgba(34,197,94,0.3)',
              animation: 'pulse 1s infinite',
            }}
          >
            updating…
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px 12px' }}>
        {/* Avatar + speech bubble */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <Avatar speaking={isSpeaking} />

          {/* Speech bubble */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(34,197,94,0.18)',
              borderRadius: '4px 12px 12px 12px',
              padding: '8px 10px',
              fontSize: 11.5,
              lineHeight: 1.6,
              color: '#d1d5db',
              minHeight: 56,
            }}
          >
            {/* Bubble arrow */}
            <div
              style={{
                position: 'absolute',
                left: -7,
                top: 8,
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: '7px solid rgba(34,197,94,0.18)',
              }}
            />
            <RichText text={displayed || '…'} />
            {isSpeaking && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 12,
                  background: '#22c55e',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'pulse 0.6s infinite',
                }}
              />
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderRadius: 8,
            background: '#07100e',
            padding: 3,
            border: '1px solid rgba(34,197,94,0.12)',
          }}
        >
          {(['opponent', 'you'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 10.5,
                fontWeight: tab === t ? 700 : 400,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.18s',
                background:
                  tab === t
                    ? 'linear-gradient(90deg,#14532d,#16a34a)'
                    : 'transparent',
                color: tab === t ? '#dcfce7' : '#6b7280',
                boxShadow: tab === t ? '0 2px 8px rgba(34,197,94,0.2)' : 'none',
              }}
            >
              {t === 'opponent' ? '👁 Opponent\'s Plan' : '⚡ Your Move'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
