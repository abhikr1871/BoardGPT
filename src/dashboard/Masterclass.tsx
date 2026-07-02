import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { COURSES, type Course } from '../data/courses';
import { MiniChessBoard } from '../components/MiniChessBoard';
import {
  probeTablebase,
  bestTablebaseMove,
  type TablebaseResult,
  type TablebaseMove,
} from '../lib/syzygy';

/**
 * Masterclass has two sub-sections, switched with a small internal tab strip:
 *
 *  (a) Courses — the bundled guided lessons. Pick a course, then step through
 *      its teaching positions: title, the FEN shown on a read-only board (when
 *      it parses) plus the raw FEN text, and the coaching point.
 *
 *  (b) Syzygy Endgame Trainer — a big playable board seeded with a classic
 *      ≤7-piece endgame. The learner plays the strong side; after each of their
 *      moves we probe a Syzygy tablebase API and auto-play the perfect reply for
 *      the opponent. A status line reports the tablebase verdict (Winning /
 *      Drawn / Losing), the DTZ/DTM distance, and the recommended move for the
 *      side to move (also highlighted on the board). The tablebase endpoint is
 *      configurable in Settings; if it can't be reached (or a custom API isn't
 *      set), we say so and fall back to free play.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';
const WARN = '#fbbf24';
const DANGER = '#f87171';

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

type Tab = 'courses' | 'trainer';

export function Masterclass() {
  const [tab, setTab] = useState<Tab>('courses');

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Masterclass
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Guided lessons on essential patterns, plus a tablebase-powered endgame trainer where a
          perfect opponent defends every position.
        </p>

        {/* Internal tab strip */}
        <div
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            marginBottom: 18,
          }}
        >
          <TabButton active={tab === 'courses'} onClick={() => setTab('courses')}>
            Courses
          </TabButton>
          <TabButton active={tab === 'trainer'} onClick={() => setTab('trainer')}>
            Syzygy Endgame Trainer
          </TabButton>
        </div>

        {tab === 'courses' ? <Courses /> : <SyzygyTrainer />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
        background: active ? ACCENT : 'transparent',
        color: active ? '#0b1120' : TEXT,
      }}
    >
      {children}
    </button>
  );
}

/** True when a FEN parses cleanly (so we only render valid positions on a board). */
function isValidFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────────── Courses ──────────────────────────────── */

function Courses() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const course: Course | undefined = COURSES.find((c) => c.id === activeId);

  function openCourse(id: string) {
    setActiveId(id);
    setStep(0);
  }

  const current = course?.steps[step];
  const fenValid = current ? isValidFen(current.fen) : false;

  return (
    <div>
      {/* Course picker */}
      {!course && (
        <div style={{ display: 'grid', gap: 10 }}>
          {COURSES.map((c) => (
            <button
              key={c.id}
              onClick={() => openCourse(c.id)}
              style={{
                ...card,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {c.steps.length} lesson{c.steps.length === 1 ? '' : 's'}
                </div>
              </span>
              <span style={{ color: ACCENT, fontSize: 18, fontWeight: 700 }}>&rsaquo;</span>
            </button>
          ))}
          {COURSES.length === 0 && (
            <div style={{ ...card, color: MUTED, fontSize: 13 }}>No courses available.</div>
          )}
        </div>
      )}

      {/* Step viewer */}
      {course && (
        <div>
          <button
            style={{ ...ghostBtn, marginBottom: 12, padding: '6px 12px' }}
            onClick={() => setActiveId(null)}
          >
            &lsaquo; All courses
          </button>

          <div style={card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, color: MUTED }}>{course.title}</span>
              <span style={{ fontSize: 12, color: MUTED }}>
                Step {step + 1} of {course.steps.length}
              </span>
            </div>

            {current && (
              <>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 12px 0' }}>
                  {current.title}
                </h2>

                {fenValid && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <MiniChessBoard fen={current.fen} interactive={false} size={300} />
                  </div>
                )}

                <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Position (FEN)</div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: TEXT,
                    background: PANEL,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6,
                    padding: '8px 10px',
                    marginBottom: 12,
                    wordBreak: 'break-all',
                  }}
                >
                  {current.fen}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: '#d1d5db',
                    borderLeft: `3px solid ${ACCENT}`,
                    paddingLeft: 12,
                  }}
                >
                  {current.point}
                </div>
              </>
            )}

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              {course.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    background: i === step ? ACCENT : BORDER,
                  }}
                />
              ))}
            </div>

            {/* Prev / Next */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button
                style={{ ...ghostBtn, opacity: step === 0 ? 0.4 : 1 }}
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                &lsaquo; Previous
              </button>
              {step < course.steps.length - 1 ? (
                <button style={primaryBtn} onClick={() => setStep((s) => s + 1)}>
                  Next &rsaquo;
                </button>
              ) : (
                <button style={primaryBtn} onClick={() => setActiveId(null)}>
                  Finish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Syzygy Endgame Trainer ──────────────────────── */

interface Endgame {
  id: string;
  name: string;
  blurb: string;
  fen: string;
}

/** A handful of classic ≤7-piece endgames. The side to move is the strong side. */
const ENDGAMES: Endgame[] = [
  {
    id: 'kq-k',
    name: 'Queen vs King',
    blurb: 'The basic K+Q mate. Box the king to the edge without stalemating.',
    fen: '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1',
  },
  {
    id: 'kr-k',
    name: 'Rook vs King',
    blurb: 'The K+R "staircase" mate. Cut the king off and walk your king up.',
    fen: '8/8/8/4k3/8/8/4R3/4K3 w - - 0 1',
  },
  {
    id: 'kp-k',
    name: 'Pawn vs King',
    blurb: 'King and pawn vs king. Master the opposition to promote.',
    fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1',
  },
  {
    id: 'kbn-k',
    name: 'Bishop + Knight vs King',
    blurb: 'The hardest basic mate. Drive the king to the bishop-colour corner.',
    fen: '8/8/8/4k3/8/8/4BN2/4K3 w - - 0 1',
  },
];

/** Human-facing verdict for the side the learner is playing. */
function verdictLabel(category: string): { text: string; color: string } {
  switch (category) {
    case 'win':
      return { text: 'Winning', color: ACCENT };
    case 'cursed-win':
      return { text: 'Winning (cursed — 50-move rule bites)', color: WARN };
    case 'draw':
      return { text: 'Drawn', color: MUTED };
    case 'blessed-loss':
      return { text: 'Losing (blessed — 50-move rule saves)', color: WARN };
    case 'loss':
      return { text: 'Losing', color: DANGER };
    default:
      return { text: 'Unknown', color: MUTED };
  }
}

function fmtDistance(res: TablebaseResult): string {
  const parts: string[] = [];
  if (res.dtm !== null) parts.push(`DTM ${Math.abs(res.dtm)}`);
  if (res.dtz !== null) parts.push(`DTZ ${Math.abs(res.dtz)}`);
  return parts.join(' · ');
}

function SyzygyTrainer() {
  const [egId, setEgId] = useState<string>(ENDGAMES[0].id);
  const endgame = ENDGAMES.find((e) => e.id === egId) ?? ENDGAMES[0];

  // The learner plays the side to move in the starting FEN (the strong side).
  const humanColor: 'w' | 'b' = (() => {
    try {
      return new Chess(endgame.fen).turn();
    } catch {
      return 'w';
    }
  })();

  const [fen, setFen] = useState<string>(endgame.fen);
  const [status, setStatus] = useState<'idle' | 'probing' | 'ready'>('idle');
  const [result, setResult] = useState<TablebaseResult | null>(null);
  const [hint, setHint] = useState<TablebaseMove | null>(null);
  // null result while state is 'ready' means the API couldn't be reached.
  const [apiFailed, setApiFailed] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Guards against out-of-order async probes (rapid moves / endgame switches).
  const probeSeq = useRef(0);

  const resetTo = useCallback((fenStr: string) => {
    setFen(fenStr);
    setResult(null);
    setHint(null);
    setApiFailed(false);
    setMoveError(null);
    setHistory([]);
    setStatus('idle');
  }, []);

  // When the chosen endgame changes, reset the board to its start.
  useEffect(() => {
    resetTo(endgame.fen);
  }, [endgame.fen, resetTo]);

  /**
   * Probe the given position and, when it's the opponent's turn, auto-play the
   * tablebase's best reply. Always refreshes the status/hint for whatever
   * position we end up on when it's the human's turn.
   */
  const advance = useCallback(
    async (positionFen: string) => {
      const seq = ++probeSeq.current;
      setStatus('probing');

      let game: Chess;
      try {
        game = new Chess(positionFen);
      } catch {
        setStatus('ready');
        return;
      }

      // Terminal position — nothing to probe or reply.
      if (game.isGameOver()) {
        if (seq !== probeSeq.current) return;
        setResult(null);
        setHint(null);
        setApiFailed(false);
        setStatus('ready');
        return;
      }

      const res = await probeTablebase(positionFen);
      if (seq !== probeSeq.current) return; // superseded by a newer probe

      if (!res) {
        // No tablebase data (unset custom API, >7 pieces, or network failure).
        setResult(null);
        setHint(null);
        setApiFailed(true);
        setStatus('ready');
        return;
      }
      setApiFailed(false);

      const sideToMove = game.turn();

      if (sideToMove === humanColor) {
        // Human's turn: show the verdict + recommended move as a hint.
        setResult(res);
        setHint(bestTablebaseMove(res));
        setStatus('ready');
        return;
      }

      // Opponent's turn: play the perfect defence, then re-probe for the human.
      const best = bestTablebaseMove(res);
      if (!best) {
        setResult(res);
        setHint(null);
        setStatus('ready');
        return;
      }

      let nextFen = positionFen;
      try {
        game.move({
          from: best.uci.slice(0, 2),
          to: best.uci.slice(2, 4),
          promotion: best.uci.length > 4 ? best.uci.slice(4, 5) : undefined,
        });
        nextFen = game.fen();
      } catch {
        // Tablebase move somehow illegal here — bail gracefully to free play.
        setResult(res);
        setHint(null);
        setStatus('ready');
        return;
      }

      if (seq !== probeSeq.current) return;
      setFen(nextFen);
      setHistory((h) => [...h, best.san]);

      // Re-probe the new (human-to-move) position for the fresh verdict/hint.
      void advance(nextFen);
    },
    [humanColor],
  );

  // Called by the board when the learner makes a move.
  const onHumanMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      setMoveError(null);
      let game: Chess;
      try {
        game = new Chess(fen);
      } catch {
        return;
      }
      // Only accept moves for the side the learner controls.
      if (game.turn() !== humanColor) return;

      let nextFen: string;
      let san: string;
      try {
        const played = game.move(move);
        san = played.san;
        nextFen = game.fen();
      } catch {
        setMoveError('Illegal move — try again.');
        return;
      }

      setFen(nextFen);
      setHistory((h) => [...h, san]);
      setHint(null);
      void advance(nextFen);
    },
    [fen, humanColor, advance],
  );

  // Whose turn is it right now / is the game over?
  const { turn, gameOver, isMate } = (() => {
    try {
      const g = new Chess(fen);
      return { turn: g.turn(), gameOver: g.isGameOver(), isMate: g.isCheckmate() };
    } catch {
      return { turn: humanColor, gameOver: false, isMate: false };
    }
  })();

  const humansTurn = turn === humanColor && !gameOver;
  const verdict = result ? verdictLabel(result.category) : null;

  return (
    <div>
      {/* Endgame picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {ENDGAMES.map((e) => (
          <button
            key={e.id}
            onClick={() => setEgId(e.id)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${e.id === egId ? ACCENT : BORDER}`,
              background: e.id === egId ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: e.id === egId ? ACCENT : TEXT,
            }}
          >
            {e.name}
          </button>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{endgame.name}</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{endgame.blurb}</div>
        <div style={{ fontSize: 12, color: MUTED }}>
          You play {humanColor === 'w' ? 'White' : 'Black'}. Make your move; a perfect opponent
          replies from the tablebase.
        </div>
      </div>

      {/* Board */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <MiniChessBoard
          fen={fen}
          orientation={humanColor}
          interactive={humansTurn}
          onMove={onHumanMove}
          highlightUci={humansTurn && hint ? hint.uci : null}
          size={460}
        />
      </div>

      {/* Status line */}
      <div style={{ ...card, marginBottom: 14 }}>
        {gameOver ? (
          <div style={{ fontSize: 14, fontWeight: 700, color: isMate ? ACCENT : MUTED }}>
            {isMate
              ? turn === humanColor
                ? 'Checkmate — you were mated.'
                : 'Checkmate — well played!'
              : 'Game over — draw (stalemate or insufficient material).'}
          </div>
        ) : status === 'probing' ? (
          <div style={{ fontSize: 13, color: MUTED }}>Consulting the tablebase…</div>
        ) : apiFailed ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: WARN, marginBottom: 4 }}>
              No tablebase response
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              A Syzygy tablebase API must be reachable to get the perfect opponent. Configure the
              Backend / Syzygy URL in Settings (it defaults to the public Lichess tablebase, which
              covers positions with ≤7 pieces). You can keep moving both sides freely in the
              meantime.
            </div>
          </div>
        ) : verdict ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: verdict.color }}>
                {verdict.text}
              </span>
              {fmtDistance(result!) && (
                <span style={{ fontSize: 12, color: MUTED, fontFamily: 'monospace' }}>
                  {fmtDistance(result!)}
                </span>
              )}
            </div>
            {humansTurn && hint && (
              <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 6 }}>
                Tablebase best move:{' '}
                <span style={{ color: ACCENT, fontWeight: 700, fontFamily: 'monospace' }}>
                  {hint.san}
                </span>{' '}
                <span style={{ color: MUTED, fontFamily: 'monospace' }}>({hint.uci})</span> — shown
                highlighted on the board.
              </div>
            )}
            {!humansTurn && (
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
                Opponent to move — replying with perfect play…
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>
            Make a move to consult the tablebase for the perfect reply.
          </div>
        )}

        {moveError && (
          <div style={{ fontSize: 12, color: DANGER, marginTop: 8 }}>{moveError}</div>
        )}
      </div>

      {/* Controls + move log */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button style={ghostBtn} onClick={() => resetTo(endgame.fen)}>
          Reset position
        </button>
        <div
          style={{
            flex: 1,
            fontSize: 12,
            color: MUTED,
            fontFamily: 'monospace',
            textAlign: 'right',
            wordBreak: 'break-word',
          }}
        >
          {history.length > 0 ? history.join('  ') : 'No moves yet.'}
        </div>
      </div>
    </div>
  );
}
