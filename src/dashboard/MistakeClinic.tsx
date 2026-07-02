import { useEffect, useMemo, useState } from 'react';
import { dueMistakes, listMistakes, reviewMistake, type Mistake } from '../lib/mistakeDB';

/**
 * Spaced-repetition drill. Pulls the mistakes that are due for review and
 * quizzes the player on them one position at a time: "you played the bad move,
 * find the better one." The player can reveal the answer and self-grade
 * (got it / missed it); each answer reschedules the card via {@link reviewMistake}.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const THEME_LABELS: Record<string, string> = {
  'hanging-piece': 'Hanging pieces',
  tactics: 'Tactics',
};

function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  border: 'none',
  background: ACCENT,
  color: '#0b1120',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export function MistakeClinic() {
  const [queue, setQueue] = useState<Mistake[]>([]);
  const [all, setAll] = useState<Mistake[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);

  async function reload() {
    setLoading(true);
    const [due, everything] = await Promise.all([dueMistakes(), listMistakes()]);
    setQueue(due);
    setAll(everything);
    setIndex(0);
    setGuess('');
    setRevealed(false);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  const current = queue[index];

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of all) counts[m.theme] = (counts[m.theme] ?? 0) + 1;
    return counts;
  }, [all]);

  const guessIsRight = useMemo(() => {
    if (!current) return false;
    const g = guess.trim().replace(/[+#!?]/g, '').toLowerCase();
    const best = current.bestMove.trim().replace(/[+#!?]/g, '').toLowerCase();
    return g.length > 0 && g === best;
  }, [guess, current]);

  async function grade(correct: boolean) {
    if (!current) return;
    await reviewMistake(current.id, correct);
    setReviewedCount((n) => n + 1);
    const next = index + 1;
    if (next >= queue.length) {
      // Finished this batch — refresh to pick up anything still due.
      await reload();
    } else {
      setIndex(next);
      setGuess('');
      setRevealed(false);
    }
  }

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Mistake Clinic
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Spaced-repetition drills built from your own blunders. Get them right and they come
          back less often; miss and they resurface tomorrow.
        </p>

        {/* Theme breakdown */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <span style={pill(false)}>Due now: {queue.length}</span>
          <span style={pill(false)}>Total saved: {all.length}</span>
          {Object.keys(themeCounts)
            .sort()
            .map((t) => (
              <span key={t} style={pill(true)}>
                {themeLabel(t)}: {themeCounts[t]}
              </span>
            ))}
        </div>

        {loading && <div style={{ fontSize: 13, color: MUTED }}>Loading drills…</div>}

        {!loading && all.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: MUTED, fontSize: 13 }}>
            No mistakes saved yet. Review a game and capture your blunders to start drilling.
          </div>
        )}

        {!loading && all.length > 0 && !current && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>
              All caught up!
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              Nothing is due right now. You reviewed {reviewedCount} position
              {reviewedCount === 1 ? '' : 's'} this session.
            </div>
          </div>
        )}

        {!loading && current && (
          <div style={card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: MUTED }}>
                Position {index + 1} of {queue.length}
              </span>
              <span style={pill(true)}>{themeLabel(current.theme)}</span>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              You played{' '}
              <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>{current.badMove}</span>.
              Find the better move.
            </div>

            <div
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: MUTED,
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: '6px 8px',
                marginBottom: 12,
                wordBreak: 'break-all',
              }}
            >
              {current.fen}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Your move (e.g. Nc7+ or e4)"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setRevealed(true);
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: `1px solid ${guessIsRight && revealed ? ACCENT : BORDER}`,
                  background: PANEL,
                  color: TEXT,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button style={ghostBtn} onClick={() => setRevealed(true)}>
                Reveal
              </button>
            </div>

            {revealed && (
              <div
                style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13 }}>
                  Best move:{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: ACCENT }}>
                    {current.bestMove}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  Your move {current.badMove} lost about {current.cpLoss} centipawns.
                </div>
                {guess.trim().length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 6,
                      fontWeight: 700,
                      color: guessIsRight ? ACCENT : '#f87171',
                    }}
                  >
                    {guessIsRight ? 'Your guess matches the best move.' : 'Your guess did not match.'}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...primaryBtn, flex: 1 }}
                onClick={() => void grade(true)}
                title="Schedule this position further out"
              >
                I got it
              </button>
              <button
                style={{ ...ghostBtn, flex: 1, borderColor: '#7f1d1d', color: '#fca5a5' }}
                onClick={() => void grade(false)}
                title="Bring this position back tomorrow"
              >
                I missed it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pill(accent: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    fontFamily: 'monospace',
    background: accent ? 'rgba(34,197,94,0.15)' : PANEL_ALT,
    color: accent ? '#4ade80' : MUTED,
    border: `1px solid ${accent ? 'rgba(34,197,94,0.3)' : BORDER}`,
  };
}
