import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { getOpeningRecommendations, type RepertoireOption } from '../engine/openings';
import { getAuth, isPremium } from '../lib/auth';
import { requestEngineAnalysis } from '../engine/stockfish';
import { MiniChessBoard } from '../components/MiniChessBoard';

/**
 * Interactive repertoire trainer (Phase 3).
 *
 * The user picks an opening from a curated list, we auto-play its first move(s)
 * onto a real, playable board, and then hand control over: the user plays the
 * recommended side and a real engine (Stockfish via the background → offscreen
 * bridge, falling back to the built-in engine, and finally to a tiny local
 * heuristic when no engine is reachable) answers for the opponent.
 *
 * Free-plan users can drill the first four openings; the rest carry a locked
 * overlay nudging toward Premium.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const FREE_LIMIT = 4;

// Standard FENs used to enumerate the opening book. The book is keyed on
// "<placement> <sideToMove>", so these three positions surface White's first
// move as well as Black's replies to 1.e4 and 1.d4.
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const AFTER_D4_FEN = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';

// Opponent reply preferences (best first) for the no-engine fallback: grab the
// centre, then develop. The first legal one is played, else any legal move.
const OPPONENT_PREFS = [
  'e5', 'e6', 'c5', 'd5', 'c6', 'Nf6', 'Nc6',
  'e4', 'd4', 'Nf3', 'c4', 'Nc3', 'g3',
  'd6', 'g6', 'Be7', 'Bc5', 'Bb4', 'O-O',
];

type EngineBadge = 'stockfish' | 'builtin' | 'fallback' | null;

/**
 * A single practiceable opening: the setup moves to auto-play (in SAN), the
 * side the student then plays, and the descriptive metadata from the book.
 */
interface PracticeOpening {
  key: string;
  /** SAN moves played from the start to reach the practice position. */
  setup: string[];
  /** The side the student practises once setup moves are on the board. */
  playAs: 'w' | 'b';
  option: RepertoireOption;
  openingName: string;
}

interface HistoryEntry {
  san: string;
  by: 'you' | 'opponent';
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
  padding: '8px 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Enumerate the curated openings from the book. For White we practise each of
 * White's first-move recommendations; for Black we practise the replies to
 * 1.e4 and 1.d4. Setup moves auto-play so the student starts right in the
 * chosen system.
 */
function buildOpeningCatalog(): PracticeOpening[] {
  const catalog: PracticeOpening[] = [];

  // White: the recommended first moves from the start position.
  const whiteRec = getOpeningRecommendations(START_FEN);
  if (whiteRec) {
    for (const opt of whiteRec.options) {
      catalog.push({
        key: `w-${opt.id}`,
        setup: [opt.moveSan],
        playAs: 'w',
        option: opt,
        openingName: whiteRec.openingName,
      });
    }
  }

  // Black: replies to 1.e4, then 1.d4. Each entry auto-plays White's first
  // move followed by Black's recommended reply, leaving White to move.
  const blackSetups: Array<{ first: string; fen: string }> = [
    { first: 'e4', fen: AFTER_E4_FEN },
    { first: 'd4', fen: AFTER_D4_FEN },
  ];
  for (const { first, fen } of blackSetups) {
    const rec = getOpeningRecommendations(fen);
    if (!rec) continue;
    for (const opt of rec.options) {
      catalog.push({
        key: `b-${opt.id}`,
        setup: [first, opt.moveSan],
        playAs: 'b',
        option: opt,
        openingName: rec.openingName,
      });
    }
  }

  return catalog;
}

/** Build a chess.js game and try to play the SAN setup moves. Bad moves are skipped. */
function gameFromSetup(setup: string[]): Chess {
  const game = new Chess();
  for (const san of setup) {
    try {
      game.move(san);
    } catch {
      // Skip an illegal setup move rather than throwing; the position simply
      // stops at the last legal ply.
      break;
    }
  }
  return game;
}

/** No-engine opponent reply: prefer centre/development, else any legal move. */
function fallbackReply(game: Chess): string | null {
  const legal = game.moves(); // SAN list
  if (legal.length === 0) return null;
  for (const pref of OPPONENT_PREFS) {
    if (legal.includes(pref)) return pref;
  }
  const developing = legal.find((m) => /^N[a-h][1-8]$/.test(m) || /^B[a-h][1-8]$/.test(m));
  return developing ?? legal[0];
}

const styleColors: Record<RepertoireOption['style'], string> = {
  aggressive: '#f87171',
  solid: '#60a5fa',
  positional: '#a78bfa',
  tactical: '#fbbf24',
  universal: '#4ade80',
};

export function RepertoireTrainer() {
  const catalog = useMemo(() => buildOpeningCatalog(), []);

  // Plan gating. Mirrors the pattern used elsewhere in the dashboard: fetch
  // auth async and derive premium once it resolves.
  const [premium, setPremium] = useState(false);
  useEffect(() => {
    let alive = true;
    getAuth()
      .then((auth) => {
        if (alive) setPremium(isPremium(auth));
      })
      .catch(() => {
        /* stay free if auth can't be read */
      });
    return () => {
      alive = false;
    };
  }, []);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fen, setFen] = useState<string>(() => new Chess().fen());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [engineBadge, setEngineBadge] = useState<EngineBadge>(null);
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Guards async engine replies so a stale reply from a previous line can't
  // land on the board after the user reset or switched openings.
  const lineToken = useRef(0);

  const selected = useMemo(
    () => catalog.find((c) => c.key === selectedKey) ?? null,
    [catalog, selectedKey],
  );

  const game = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const yourTurn = selected ? game.turn() === selected.playAs && !game.isGameOver() : false;
  const gameOver = game.isGameOver();

  /** Load an opening: auto-play its setup and enter practice mode. */
  function startOpening(op: PracticeOpening) {
    lineToken.current += 1;
    const g = gameFromSetup(op.setup);
    setSelectedKey(op.key);
    setFen(g.fen());
    setHistory(
      op.setup.map(
        (san, i): HistoryEntry => ({ san, by: i % 2 === 0 ? 'you' : 'opponent' }),
      ),
    );
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setNote(null);
  }

  /** Reset the currently-selected opening back to its starting setup. */
  function resetLine() {
    if (selected) startOpening(selected);
  }

  /** Clear the selection and return to the opening picker. */
  function backToPicker() {
    lineToken.current += 1;
    setSelectedKey(null);
    setFen(new Chess().fen());
    setHistory([]);
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setNote(null);
  }

  /**
   * Ask the engine (or fall back) for the opponent's reply and apply it. Runs
   * off the render path; guarded by a line token so stale replies are dropped.
   */
  async function playEngineReply(afterUserFen: string, token: number) {
    setThinking(true);
    let badge: EngineBadge = 'fallback';
    let chosenUci: string | null = null;

    try {
      const analysis = await requestEngineAnalysis(afterUserFen, 1, 16);
      if (analysis && analysis.lines.length > 0) {
        chosenUci = analysis.lines[0].uci;
        badge = analysis.engine; // 'stockfish' | 'builtin'
      }
    } catch {
      chosenUci = null;
    }

    // If the line changed while we were thinking, abandon this reply.
    if (token !== lineToken.current) return;

    let reply: Chess;
    try {
      reply = new Chess(afterUserFen);
    } catch {
      setThinking(false);
      return;
    }

    let played: { san: string } | null = null;

    // Try the engine's move first (through chess.js — illegal moves throw).
    if (chosenUci) {
      const from = chosenUci.slice(0, 2);
      const to = chosenUci.slice(2, 4);
      const promotion = chosenUci.length > 4 ? chosenUci[4] : undefined;
      try {
        played = reply.move(promotion ? { from, to, promotion } : { from, to });
      } catch {
        played = null;
      }
    }

    // Engine gave nothing usable → heuristic fallback.
    if (!played) {
      const san = fallbackReply(reply);
      badge = 'fallback';
      if (san) {
        try {
          played = reply.move(san);
        } catch {
          played = null;
        }
      }
    }

    if (token !== lineToken.current) return;
    setThinking(false);
    setEngineBadge(badge);

    if (played) {
      setFen(reply.fen());
      setLastUci(chosenUci && badge !== 'fallback' ? chosenUci : null);
      setHistory((prev) => [...prev, { san: played!.san, by: 'opponent' }]);
    }
  }

  /**
   * Apply the user's move (from the interactive board) and trigger the engine
   * reply. Illegal moves are ignored — chess.js throws, we swallow it.
   */
  function handleUserMove(move: { from: string; to: string; promotion?: string }) {
    if (!selected || !yourTurn) return;
    setNote(null);

    let next: Chess;
    try {
      next = new Chess(fen);
    } catch {
      return;
    }

    let played: { san: string } | null = null;
    try {
      played = next.move(move);
    } catch {
      played = null;
    }
    if (!played) {
      // Not a legal move here — ignore silently (the board only offers legal
      // targets, so this is belt-and-braces).
      return;
    }

    const token = lineToken.current;
    setFen(next.fen());
    setLastUci(null);
    setHistory((prev) => [...prev, { san: played!.san, by: 'you' }]);

    // Opponent replies unless the game just ended.
    if (!next.isGameOver()) {
      void playEngineReply(next.fen(), token);
    }
  }

  // Pair the flat history into numbered full-moves for display.
  const movePairs = useMemo(() => {
    const pairs: Array<{ no: number; white?: HistoryEntry; black?: HistoryEntry }> = [];
    history.forEach((h, i) => {
      const no = Math.floor(i / 2) + 1;
      if (i % 2 === 0) pairs.push({ no, white: h });
      else pairs[pairs.length - 1].black = h;
    });
    return pairs;
  }, [history]);

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Repertoire Trainer
        </h1>
        <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px 0' }}>
          Pick an opening to rehearse. We set up the position for you, then you play on against the
          engine — practising the ideas until they feel natural.
        </p>

        {!selected ? (
          /* ─── Opening picker ─────────────────────────────────────────── */
          <OpeningPicker catalog={catalog} premium={premium} onPick={startOpening} />
        ) : (
          /* ─── Practice view ──────────────────────────────────────────── */
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Board column */}
            <div style={{ flex: '0 0 auto' }}>
              <MiniChessBoard
                fen={fen}
                orientation={selected.playAs}
                onMove={handleUserMove}
                interactive={yourTurn}
                highlightUci={lastUci}
                size={360}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  flexWrap: 'wrap',
                }}
              >
                <StatusBadge yourTurn={yourTurn} thinking={thinking} gameOver={gameOver} game={game} />
                <EngineChip badge={engineBadge} />
                <button style={{ ...ghostBtn, marginLeft: 'auto' }} onClick={resetLine}>
                  New line / Reset
                </button>
                <button style={ghostBtn} onClick={backToPicker}>
                  ← Openings
                </button>
              </div>

              {note && (
                <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 8 }}>{note}</div>
              )}
            </div>

            {/* Info column */}
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{selected.option.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(148,163,184,0.15)',
                      color: styleColors[selected.option.style],
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {selected.option.style}
                  </span>
                  <span style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>
                    [{selected.option.eco}]
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginTop: 4 }}>
                  {selected.option.title} · You play {selected.playAs === 'w' ? 'White' : 'Black'}
                </div>
                <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, margin: '8px 0 0 0' }}>
                  {selected.option.description}
                </p>
              </div>

              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
                  Key ideas
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                  {selected.option.keyIdeas.map((idea, i) => (
                    <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Move list */}
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
                  Moves
                </div>
                {history.length === 0 ? (
                  <div style={{ fontSize: 12, color: MUTED }}>No moves yet.</div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      fontFamily: 'monospace',
                      fontSize: 13,
                    }}
                  >
                    {movePairs.map((p) => (
                      <span key={p.no} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
                        <span style={{ color: MUTED }}>{p.no}.</span>
                        {p.white && <MovePill entry={p.white} />}
                        {p.black && <MovePill entry={p.black} />}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {gameOver && (
                <div
                  style={{
                    ...card,
                    marginTop: 12,
                    borderColor: 'rgba(34,197,94,0.4)',
                    background: 'rgba(34,197,94,0.08)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                    {game.isCheckmate() ? 'Checkmate!' : 'Game over.'}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                    Reset the line to drill this opening again.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function OpeningPicker({
  catalog,
  premium,
  onPick,
}: {
  catalog: PracticeOpening[];
  premium: boolean;
  onPick: (op: PracticeOpening) => void;
}) {
  return (
    <>
      {!premium && (
        <div
          style={{
            ...card,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'rgba(34,197,94,0.35)',
            background: 'rgba(34,197,94,0.08)',
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>⭐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Free plan: first {FREE_LIMIT} openings</div>
            <div style={{ fontSize: 12, color: MUTED }}>
              Upgrade for all 50+ openings across every mainline system.
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {catalog.map((op, i) => {
          const locked = !premium && i >= FREE_LIMIT;
          return (
            <button
              key={op.key}
              onClick={() => !locked && onPick(op)}
              disabled={locked}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${locked ? BORDER : 'rgba(34,197,94,0.3)'}`,
                background: locked ? PANEL : 'rgba(34,197,94,0.08)',
                color: TEXT,
                cursor: locked ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>
                  {op.playAs === 'w' ? 'White' : 'Black'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: styleColors[op.option.style],
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {op.option.style}
                </span>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace', marginLeft: 'auto' }}>
                  [{op.option.eco}]
                </span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
                {op.option.name}
              </div>
              <div style={{ fontSize: 11.5, color: '#4ade80', marginTop: 2 }}>{op.option.title}</div>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace', marginTop: 6 }}>
                {op.setup.join(' ')}
              </div>

              {locked && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15,23,42,0.72)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    backdropFilter: 'blur(1px)',
                  }}
                >
                  <span aria-hidden style={{ fontSize: 22 }}>⭐</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Premium</span>
                  <span style={{ fontSize: 10, color: MUTED }}>Upgrade for all 50+ openings</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MovePill({ entry }: { entry: HistoryEntry }) {
  return (
    <span
      title={entry.by === 'you' ? 'Your move' : 'Engine reply'}
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: entry.by === 'you' ? 'rgba(34,197,94,0.15)' : PANEL,
        color: entry.by === 'you' ? '#4ade80' : TEXT,
        border: `1px solid ${BORDER}`,
      }}
    >
      {entry.san}
    </span>
  );
}

function StatusBadge({
  yourTurn,
  thinking,
  gameOver,
  game,
}: {
  yourTurn: boolean;
  thinking: boolean;
  gameOver: boolean;
  game: Chess;
}) {
  let label: string;
  let color = MUTED;
  if (gameOver) {
    label = game.isCheckmate() ? 'Checkmate' : 'Game over';
    color = '#4ade80';
  } else if (thinking) {
    label = 'Engine thinking…';
  } else if (yourTurn) {
    label = 'Your move';
    color = ACCENT;
  } else {
    label = 'Opponent to move';
  }
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        borderRadius: 999,
        background: 'rgba(148,163,184,0.12)',
        border: `1px solid ${BORDER}`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function EngineChip({ badge }: { badge: EngineBadge }) {
  if (!badge) return null;
  const isEngine = badge === 'stockfish' || badge === 'builtin';
  const label =
    badge === 'stockfish' ? 'Stockfish' : badge === 'builtin' ? 'Built-in engine' : 'Fallback';
  return (
    <span
      title={
        isEngine
          ? 'Opponent moves come from the analysis engine.'
          : 'No engine reachable — using a simple heuristic opponent.'
      }
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        borderRadius: 999,
        background: isEngine ? 'rgba(34,197,94,0.12)' : 'rgba(251,146,60,0.12)',
        border: `1px solid ${isEngine ? 'rgba(34,197,94,0.35)' : 'rgba(251,146,60,0.35)'}`,
        color: isEngine ? '#4ade80' : '#fb923c',
      }}
    >
      {isEngine ? '⚡' : '⚠️'} {label}
    </span>
  );
}
