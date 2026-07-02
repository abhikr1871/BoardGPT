import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { MiniChessBoard } from '../components/MiniChessBoard';
import { EvalBar } from '../components/EvalBar';
import { requestEngineAnalysis } from '../engine/stockfish';
import { OPENING_CATALOG, type CatalogOpening } from '../data/openingCatalog';

/**
 * Opening Trainer (full-width, advanced).
 *
 * LEFT  — a big playable board with a vertical evaluation bar beside it. The
 *         eval is computed by asking the engine to analyse the current FEN
 *         (debounced + token-guarded), converted from side-to-move POV into
 *         White POV for the bar.
 * RIGHT — a searchable/filterable list of every opening in the catalog. Picking
 *         one auto-plays its book line onto the board, shows a theory panel and
 *         the running SAN move list, and hands control to the student.
 *
 * PLAY vs STOCKFISH — once the book line is on the board the student plays the
 * opening's side; each of their moves is answered by the engine's top line
 * (falling back to a simple developing move when no engine is reachable).
 *
 * This tab is gated at the dashboard level, so there is no free/premium limit
 * here: the whole catalog is always shown.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const START_FEN = new Chess().fen();

// No-engine opponent preferences (best first): grab the centre, then develop.
const FALLBACK_PREFS = [
  'e5', 'e6', 'c5', 'd5', 'c6', 'Nf6', 'Nc6', 'g6', 'd6',
  'e4', 'd4', 'Nf3', 'c4', 'Nc3', 'g3',
  'Be7', 'Bc5', 'Bb4', 'Bg7', 'Bf5', 'O-O',
];

type EngineBadge = 'stockfish' | 'builtin' | 'fallback' | null;
type SideFilter = 'all' | 'w' | 'b';

interface HistoryEntry {
  san: string;
  /** 'book' = auto-played opening move, 'you' = student, 'engine' = opponent. */
  by: 'book' | 'you' | 'engine';
}

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
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

/** Build a chess.js game from the initial position by playing SAN moves. Bad moves stop the line. */
function gameFromMoves(moves: string[]): { game: Chess; played: string[] } {
  const game = new Chess();
  const played: string[] = [];
  for (const san of moves) {
    try {
      const m = game.move(san);
      played.push(m.san);
    } catch {
      break; // stop at the last legal ply rather than throwing
    }
  }
  return { game, played };
}

/** No-engine reply: prefer centre/development, else any legal move. */
function fallbackReply(game: Chess): string | null {
  const legal = game.moves();
  if (legal.length === 0) return null;
  for (const pref of FALLBACK_PREFS) {
    if (legal.includes(pref)) return pref;
  }
  const developing = legal.find((m) => /^N[a-h][1-8]$/.test(m) || /^B[a-h][1-8]$/.test(m));
  return developing ?? legal[0];
}

/** Human label for the repertoire side. */
function sideLabel(side: CatalogOpening['side']): string {
  return side === 'w' ? 'White' : side === 'b' ? 'Black' : 'Either';
}

export function RepertoireTrainer() {
  // ── Opening list / filtering ──────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Board / game state ─────────────────────────────────────────────────────
  const [fen, setFen] = useState<string>(START_FEN);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [engineBadge, setEngineBadge] = useState<EngineBadge>(null);
  const [thinking, setThinking] = useState(false);

  // ── Eval bar state ──────────────────────────────────────────────────────────
  const [evalCp, setEvalCp] = useState(0); // White POV centipawns

  // Token guards: bump on every reset / opening switch so stale async replies
  // (engine opponent move, eval analysis) can never land on a newer position.
  const lineToken = useRef(0);
  const evalToken = useRef(0);

  const selected = useMemo(
    () => OPENING_CATALOG.find((o) => o.id === selectedId) ?? null,
    [selectedId],
  );

  const game = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const gameOver = game.isGameOver();
  // Whose side the student plays. For 'either' openings, play whoever moved first (White).
  const playAs: 'w' | 'b' = selected ? (selected.side === 'b' ? 'b' : 'w') : 'w';
  const yourTurn = selected ? game.turn() === playAs && !gameOver : false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OPENING_CATALOG.filter((o) => {
      if (sideFilter !== 'all' && o.side !== sideFilter && o.side !== 'either') return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.eco.toLowerCase().includes(q) ||
        o.moves.join(' ').toLowerCase().includes(q)
      );
    });
  }, [query, sideFilter]);

  // ── Debounced eval: analyse the current FEN whenever it changes. ────────────
  useEffect(() => {
    if (gameOver) return; // keep the last bar reading when the game is over
    evalToken.current += 1;
    const token = evalToken.current;
    const currentFen = fen;

    const timer = setTimeout(() => {
      void (async () => {
        let cp = 0;
        try {
          const analysis = await requestEngineAnalysis(currentFen, 1, 16);
          if (analysis && analysis.lines.length > 0) {
            const top = analysis.lines[0];
            // Engine cp is side-to-move POV. Convert to White POV for the bar.
            let whiteCp: number;
            if (top.mate !== null) {
              const sign = top.mate >= 0 ? 1 : -1;
              whiteCp = sign * 10000;
            } else {
              whiteCp = top.cp;
            }
            let stm: 'w' | 'b' = 'w';
            try {
              stm = new Chess(currentFen).turn();
            } catch {
              stm = 'w';
            }
            if (stm === 'b') whiteCp = -whiteCp;
            cp = whiteCp;
          }
        } catch {
          cp = 0;
        }
        if (token !== evalToken.current) return; // a newer position superseded us
        setEvalCp(cp);
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [fen, gameOver]);

  /** Load an opening: auto-play its book line, orient the board, enter practice. */
  const startOpening = useCallback((op: CatalogOpening) => {
    lineToken.current += 1;
    const { game: g, played } = gameFromMoves(op.moves);
    const side: 'w' | 'b' = op.side === 'b' ? 'b' : 'w';
    setSelectedId(op.id);
    setOrientation(side);
    setFen(g.fen());
    setHistory(played.map((san): HistoryEntry => ({ san, by: 'book' })));
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setEvalCp(0);
  }, []);

  /** Reset to the currently-selected opening's book line (or to the start). */
  const resetBoard = useCallback(() => {
    if (selected) {
      startOpening(selected);
      return;
    }
    lineToken.current += 1;
    setFen(START_FEN);
    setHistory([]);
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setEvalCp(0);
  }, [selected, startOpening]);

  const flipBoard = useCallback(() => {
    setOrientation((o) => (o === 'w' ? 'b' : 'w'));
  }, []);

  /**
   * Ask the engine for the opponent's reply and apply it (guarded by the line
   * token). Falls back to a developing move when no engine answers.
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

    if (token !== lineToken.current) return; // line changed while thinking

    let reply: Chess;
    try {
      reply = new Chess(afterUserFen);
    } catch {
      setThinking(false);
      return;
    }

    let played: { san: string } | null = null;

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
      setHistory((prev) => [...prev, { san: played!.san, by: 'engine' }]);
    }
  }

  /** Apply the student's move and trigger the engine reply. Illegal moves are ignored. */
  function handleUserMove(move: { from: string; to: string; promotion?: string }) {
    if (!selected || !yourTurn) return;

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
    if (!played) return; // not legal here (board only offers legal targets anyway)

    const token = lineToken.current;
    setFen(next.fen());
    setLastUci(`${move.from}${move.to}`);
    setHistory((prev) => [...prev, { san: played!.san, by: 'you' }]);

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

  const boardSize = 500;

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif', width: '100%' }}>
      <div style={{ width: '100%', boxSizing: 'border-box', padding: 24 }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Opening Trainer
        </h1>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px 0' }}>
          Search any well-known opening, watch it play out on a full-size board with a live
          evaluation bar, study its ideas, then play the line on against Stockfish.
        </p>

        {/* ── Two-column layout: big board + eval on the left, list/theory right ── */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          {/* ─────────────── LEFT: board + eval bar ─────────────── */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <EvalBar cp={evalCp} height={boardSize} />
              <MiniChessBoard
                fen={fen}
                orientation={orientation}
                onMove={handleUserMove}
                interactive={yourTurn}
                highlightUci={lastUci}
                size={boardSize}
              />
            </div>

            {/* Status row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <StatusBadge
                selected={!!selected}
                yourTurn={yourTurn}
                thinking={thinking}
                gameOver={gameOver}
                game={game}
                playAs={playAs}
              />
              <EngineChip badge={engineBadge} />
              <span
                style={{
                  fontSize: 12,
                  color: MUTED,
                  fontFamily: 'monospace',
                }}
                title="Evaluation (White POV)"
              >
                {evalCp >= 0 ? '+' : ''}
                {(evalCp / 100).toFixed(1)}
              </span>
              <button style={{ ...ghostBtn, marginLeft: 'auto' }} onClick={resetBoard}>
                Reset
              </button>
              <button style={ghostBtn} onClick={flipBoard}>
                Flip
              </button>
            </div>

            {selected && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                You play {sideLabel(playAs)} · engine answers for the other side.
              </div>
            )}
          </div>

          {/* ─────────────── RIGHT: opening list + theory ─────────────── */}
          <div style={{ flex: '1 1 380px', minWidth: 320, display: 'grid', gap: 16 }}>
            {/* Theory panel (only once an opening is chosen) */}
            {selected && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{selected.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: MUTED,
                      fontFamily: 'monospace',
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(148,163,184,0.12)',
                    }}
                  >
                    [{selected.eco}]
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      color: ACCENT,
                    }}
                  >
                    {sideLabel(selected.side)}
                  </span>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, margin: '12px 0 6px 0' }}>
                  Key ideas
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                  {selected.ideas.map((idea, i) => (
                    <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      {idea}
                    </li>
                  ))}
                </ul>

                {/* Running SAN move list */}
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, margin: '14px 0 6px 0' }}>
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
                      <span
                        key={p.no}
                        style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}
                      >
                        <span style={{ color: MUTED }}>{p.no}.</span>
                        {p.white && <MovePill entry={p.white} />}
                        {p.black && <MovePill entry={p.black} />}
                      </span>
                    ))}
                  </div>
                )}

                {gameOver && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid rgba(34,197,94,0.4)',
                      background: 'rgba(34,197,94,0.08)',
                      fontSize: 12.5,
                      color: '#4ade80',
                      fontWeight: 600,
                    }}
                  >
                    {game.isCheckmate() ? 'Checkmate!' : 'Game over.'} Reset to drill the line again.
                  </div>
                )}
              </div>
            )}

            {/* Search / filter controls */}
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search openings, ECO, or moves…"
                  style={{
                    flex: '1 1 200px',
                    minWidth: 160,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: PANEL,
                    color: TEXT,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'w', 'b'] as SideFilter[]).map((sf) => {
                    const active = sideFilter === sf;
                    return (
                      <button
                        key={sf}
                        onClick={() => setSideFilter(sf)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1px solid ${active ? ACCENT : BORDER}`,
                          background: active ? 'rgba(34,197,94,0.15)' : 'transparent',
                          color: active ? '#4ade80' : TEXT,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {sf === 'all' ? 'All' : sf === 'w' ? 'White' : 'Black'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                {filtered.length} of {OPENING_CATALOG.length} openings
              </div>

              {/* Scrollable opening list */}
              <div
                style={{
                  marginTop: 10,
                  maxHeight: 460,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 6,
                  paddingRight: 4,
                }}
              >
                {filtered.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: MUTED, padding: 12 }}>
                    No openings match “{query}”.
                  </div>
                ) : (
                  filtered.map((op) => {
                    const active = op.id === selectedId;
                    return (
                      <button
                        key={op.id}
                        onClick={() => startOpening(op)}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: `1px solid ${active ? ACCENT : BORDER}`,
                          background: active ? 'rgba(34,197,94,0.12)' : PANEL,
                          color: TEXT,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}
                        >
                          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{op.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              fontFamily: 'monospace',
                              marginLeft: 'auto',
                            }}
                          >
                            [{op.eco}]
                          </span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                              color: op.side === 'w' ? '#93c5fd' : op.side === 'b' ? '#fca5a5' : MUTED,
                            }}
                          >
                            {sideLabel(op.side)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>
                          {op.moves.join(' ')}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function MovePill({ entry }: { entry: HistoryEntry }) {
  const isYou = entry.by === 'you';
  const isBook = entry.by === 'book';
  return (
    <span
      title={isYou ? 'Your move' : isBook ? 'Opening line' : 'Engine reply'}
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: isYou ? 'rgba(34,197,94,0.15)' : isBook ? 'rgba(148,163,184,0.12)' : PANEL,
        color: isYou ? '#4ade80' : TEXT,
        border: `1px solid ${BORDER}`,
      }}
    >
      {entry.san}
    </span>
  );
}

function StatusBadge({
  selected,
  yourTurn,
  thinking,
  gameOver,
  game,
  playAs,
}: {
  selected: boolean;
  yourTurn: boolean;
  thinking: boolean;
  gameOver: boolean;
  game: Chess;
  playAs: 'w' | 'b';
}) {
  let label: string;
  let color = MUTED;
  if (!selected) {
    label = 'Pick an opening →';
  } else if (gameOver) {
    label = game.isCheckmate() ? 'Checkmate' : 'Game over';
    color = '#4ade80';
  } else if (thinking) {
    label = 'Stockfish thinking…';
  } else if (yourTurn) {
    label = `Your move (${playAs === 'w' ? 'White' : 'Black'})`;
    color = ACCENT;
  } else {
    label = 'Engine to move';
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
