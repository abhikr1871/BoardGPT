import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { MiniChessBoard } from '../components/MiniChessBoard';
import { EvalBar } from '../components/EvalBar';
import { reviewGame } from '../engine/postgame';
import { requestEngineAnalysis } from '../engine/stockfish';
import type { AnnotatedMove, GameReview, MoveQuality } from '../types';

/**
 * ReviewBoard — replay & analyse a finished game on a big, navigable board.
 *
 * Driven entirely by a PGN string (past matches are stored as PGN). On mount /
 * when `pgn` changes we run {@link reviewGame} to get an annotated move list,
 * then build a positions array so the user can step ply-by-ply. A large
 * {@link MiniChessBoard} sits on the left beside an {@link EvalBar}; a live
 * {@link requestEngineAnalysis} call for the current FEN gives us the engine's
 * top move to highlight (and a fresh white-POV eval to complement the stored
 * annotation).
 *
 * "Explore from here" lets the player make a legal move on the board to branch
 * into their own line. That switches the component into a live sparring mode
 * where the engine plays the replies; "Back to game" restores the reviewed
 * line at the ply they left from. Every engine call is async and guarded so the
 * UI never blocks.
 */

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';
const BOARD_SIZE = 460;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Colour + label + short symbol for each move-quality classification. */
const QUALITY_META: Record<MoveQuality, { color: string; label: string; symbol: string }> = {
  brilliant: { color: '#22c55e', label: 'Brilliant', symbol: '!!' },
  best: { color: '#4ade80', label: 'Best', symbol: '' },
  good: { color: '#86efac', label: 'Good', symbol: '' },
  book: { color: '#93c5fd', label: 'Book', symbol: '' },
  inaccuracy: { color: '#facc15', label: 'Inaccuracy', symbol: '?!' },
  mistake: { color: '#fb923c', label: 'Mistake', symbol: '?' },
  blunder: { color: '#ef4444', label: 'Blunder', symbol: '??' },
};

interface LiveInfo {
  bestUci: string | null;
  bestSan: string | null;
  /** White-POV centipawns for the current position. */
  cp: number | null;
  mate: number | null;
  engine: 'stockfish' | 'builtin' | null;
}

/** Safely construct a Chess instance from a FEN; null if the FEN is invalid. */
function tryChess(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

/** Side to move encoded in a FEN ('w' by default when unparsable). */
function turnOf(fen: string): 'w' | 'b' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'b' : 'w';
}

/** Convert a side-to-move-POV centipawn score to white POV for the eval bar. */
function toWhitePov(cp: number, turn: 'w' | 'b'): number {
  return turn === 'b' ? -cp : cp;
}

const card: React.CSSProperties = {
  background: PANEL_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 16,
};

const navBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: PANEL,
  color: TEXT,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 44,
  lineHeight: 1,
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

function formatScore(cp: number | null, mate: number | null): string {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp === null) return '—';
  const pawns = cp / 100;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(2);
}

export function ReviewBoard({ pgn }: { pgn: string }) {
  const [review, setReview] = useState<GameReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ply cursor: 0..moves.length (moves.length === final position after last move).
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');

  // Live engine analysis of whatever position is currently on the board.
  const [live, setLive] = useState<LiveInfo>({
    bestUci: null,
    bestSan: null,
    cp: null,
    mate: null,
    engine: null,
  });
  const [analyzing, setAnalyzing] = useState(false);

  // "Explore from here" branch state. When exploreFen is non-null we are in
  // live sparring mode and the reviewed line is paused.
  const [exploreFen, setExploreFen] = useState<string | null>(null);
  const [exploreFromPly, setExploreFromPly] = useState<number>(0);
  const [exploreHistory, setExploreHistory] = useState<string[]>([]);
  const [engineThinking, setEngineThinking] = useState(false);
  const [exploreMsg, setExploreMsg] = useState<string | null>(null);

  // Guards a race where a stale async analysis result overwrites a newer one.
  const analysisSeq = useRef(0);

  // --- Run the post-game review whenever the PGN changes. ------------------
  useEffect(() => {
    setReview(null);
    setReviewError(null);
    setPly(0);
    setExploreFen(null);
    setExploreHistory([]);
    setLive({ bestUci: null, bestSan: null, cp: null, mate: null, engine: null });

    const trimmed = (pgn ?? '').trim();
    if (!trimmed) {
      setReviewError('empty');
      return;
    }
    try {
      const result = reviewGame(trimmed);
      if (!result || !result.moves.length) {
        setReviewError('empty');
        return;
      }
      setReview(result);
    } catch {
      setReviewError('invalid');
    }
  }, [pgn]);

  const moves: AnnotatedMove[] = review?.moves ?? [];

  // Positions array: fenBefore of every move, plus the final fenAfter. Indexed
  // by ply so positions[ply] is the board state at that cursor.
  const positions = useMemo<string[]>(() => {
    if (!moves.length) return [START_FEN];
    const fens = moves.map((m) => m.fenBefore);
    fens.push(moves[moves.length - 1].fenAfter);
    return fens;
  }, [moves]);

  const inExplore = exploreFen !== null;

  // The FEN currently shown on the board.
  const currentFen = inExplore
    ? (exploreFen as string)
    : positions[Math.min(ply, positions.length - 1)] ?? START_FEN;

  const currentTurn = turnOf(currentFen);

  // The annotated move that produced the shown position (null at ply 0 / final
  // beyond list). Used for the classification detail card + stored eval.
  const shownMove: AnnotatedMove | null =
    !inExplore && ply > 0 && ply <= moves.length ? moves[ply - 1] : null;

  // --- Live engine analysis of the current board position. -----------------
  const analyzeCurrent = useCallback(
    async (fen: string) => {
      const seq = ++analysisSeq.current;
      setAnalyzing(true);
      try {
        const res = await requestEngineAnalysis(fen, 3, 18);
        if (seq !== analysisSeq.current) return; // superseded by a newer request
        if (!res || !res.lines.length) {
          setLive({ bestUci: null, bestSan: null, cp: null, mate: null, engine: null });
          return;
        }
        const top = res.lines[0];
        const turn = turnOf(fen);
        setLive({
          bestUci: top.uci,
          bestSan: top.san,
          cp: toWhitePov(top.cp, turn),
          mate: top.mate === null ? null : toWhitePov(top.mate, turn),
          engine: res.engine,
        });
      } catch {
        if (seq === analysisSeq.current) {
          setLive({ bestUci: null, bestSan: null, cp: null, mate: null, engine: null });
        }
      } finally {
        if (seq === analysisSeq.current) setAnalyzing(false);
      }
    },
    [],
  );

  // Re-analyse whenever the shown FEN changes (guarded, non-blocking).
  useEffect(() => {
    if (reviewError) return;
    void analyzeCurrent(currentFen);
  }, [currentFen, reviewError, analyzeCurrent]);

  // Eval shown on the bar: prefer the live white-POV score; otherwise fall back
  // to the stored annotation for the shown position; otherwise 0 (equal).
  const barCp = useMemo<number>(() => {
    if (live.cp !== null) return live.cp;
    if (inExplore) return 0;
    if (shownMove) return shownMove.evalAfter;
    if (ply === 0) return 0;
    return 0;
  }, [live.cp, inExplore, shownMove, ply]);

  // Highlight the engine's best move for the current position (from live), but
  // only when it actually corresponds to the shown FEN's side to move.
  const highlightUci = live.bestUci;

  // --- Navigation ----------------------------------------------------------
  const lastPly = positions.length - 1;
  const goFirst = () => setPly(0);
  const goPrev = () => setPly((p) => Math.max(0, p - 1));
  const goNext = () => setPly((p) => Math.min(lastPly, p + 1));
  const goLast = () => setPly(lastPly);
  const jumpTo = (targetPly: number) => {
    setExploreFen(null);
    setExploreHistory([]);
    setExploreMsg(null);
    setPly(Math.max(0, Math.min(lastPly, targetPly)));
  };

  // Keyboard arrows for quick stepping while reviewing (disabled in explore).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inExplore) return;
      if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'Home') {
        goFirst();
      } else if (e.key === 'End') {
        goLast();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // lastPly changes with the loaded game; re-bind so bounds stay correct.
  }, [inExplore, lastPly]);

  // --- Explore-from-here (branch into a live sparring line). ----------------
  const engineReply = useCallback(async (fen: string) => {
    const game = tryChess(fen);
    if (!game || game.isGameOver()) return;
    setEngineThinking(true);
    try {
      const res = await requestEngineAnalysis(fen, 1, 18);
      const uci = res && res.lines.length ? res.lines[0].uci : null;
      let played = false;
      if (uci) {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        try {
          game.move(promotion ? { from, to, promotion } : { from, to });
          played = true;
        } catch {
          played = false;
        }
      }
      if (!played) {
        // No engine move available (e.g. messaging bus absent) — pick any legal
        // move so the sparring line can still progress.
        const legal = game.moves({ verbose: true });
        if (legal.length) {
          const m = legal[0];
          game.move({ from: m.from, to: m.to, promotion: m.promotion });
          played = true;
        }
      }
      if (played) {
        const next = game.fen();
        setExploreFen(next);
        setExploreHistory((h) => [...h, next]);
      }
    } catch {
      /* engine unavailable — leave the position for the user to continue */
    } finally {
      setEngineThinking(false);
    }
  }, []);

  // Handle a user move on the board. Only enabled when it is the human's turn.
  const handleUserMove = useCallback(
    (mv: { from: string; to: string; promotion?: string }) => {
      const baseFen = inExplore ? (exploreFen as string) : currentFen;
      const game = tryChess(baseFen);
      if (!game) return;
      try {
        game.move(mv.promotion ? { from: mv.from, to: mv.to, promotion: mv.promotion } : { from: mv.from, to: mv.to });
      } catch {
        return; // illegal — MiniChessBoard shouldn't offer it, but guard anyway
      }
      const afterUser = game.fen();
      const humanSide = turnOf(baseFen);

      if (!inExplore) {
        // First branch move: enter explore mode, remembering where we left off.
        setExploreFromPly(ply);
        setExploreMsg(
          `Exploring your own line from move ${
            shownMove ? shownMove.moveNumber : Math.floor(ply / 2) + 1
          }. The engine will answer as ${humanSide === 'w' ? 'Black' : 'White'}.`,
        );
        setExploreHistory([baseFen, afterUser]);
      } else {
        setExploreHistory((h) => [...h, afterUser]);
      }
      setExploreFen(afterUser);

      // Let the engine reply for the other side (async, guarded).
      if (!game.isGameOver()) {
        void engineReply(afterUser);
      }
    },
    [inExplore, exploreFen, currentFen, ply, shownMove, engineReply],
  );

  const backToGame = () => {
    setExploreFen(null);
    setExploreHistory([]);
    setExploreMsg(null);
    setPly(Math.max(0, Math.min(lastPly, exploreFromPly)));
  };

  const undoExplore = () => {
    setExploreHistory((h) => {
      if (h.length <= 1) {
        // Back to the branch point → exit explore mode entirely.
        setExploreFen(null);
        setExploreMsg(null);
        setPly(Math.max(0, Math.min(lastPly, exploreFromPly)));
        return [];
      }
      const next = h.slice(0, -1);
      setExploreFen(next[next.length - 1]);
      return next;
    });
  };

  const startExplore = () => {
    // Seed explore mode from the current reviewed position without a move yet,
    // so the user can pick their first branching move on the board.
    setExploreFromPly(ply);
    setExploreFen(currentFen);
    setExploreHistory([currentFen]);
    setExploreMsg('Explore mode — make a move on the board to branch into your own line.');
  };

  // The human controls the side to move at the moment they entered explore, so
  // the board stays interactive only on their turns (engine handles the rest).
  const boardInteractive = inExplore && !engineThinking;
  const boardTurn = currentTurn;

  // --- Empty / invalid PGN. ------------------------------------------------
  if (reviewError) {
    return (
      <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
            Game Review
          </h1>
          <div style={{ ...card, textAlign: 'center', color: MUTED, fontSize: 13, marginTop: 12 }}>
            {reviewError === 'empty'
              ? 'No game to review yet. Pick a game from your history to load its PGN here.'
              : 'This PGN could not be parsed. Please choose a valid recorded game.'}
          </div>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
          <div style={{ fontSize: 13, color: MUTED }}>Analysing game…</div>
        </div>
      </div>
    );
  }

  // Group moves into rows of {white, black} for the move-list panel.
  const rows: { moveNumber: number; white?: AnnotatedMove; black?: AnnotatedMove }[] = [];
  for (const m of moves) {
    let row = rows.find((r) => r.moveNumber === m.moveNumber);
    if (!row) {
      row = { moveNumber: m.moveNumber };
      rows.push(row);
    }
    if (m.color === 'w') row.white = m;
    else row.black = m;
  }

  const moveLabel = inExplore
    ? 'Exploring your line'
    : ply === 0
      ? 'Starting position'
      : shownMove
        ? `${shownMove.moveNumber}${shownMove.color === 'w' ? '.' : '...'} ${shownMove.san}`
        : `Move ${ply}`;

  const shownMeta = shownMove ? QUALITY_META[shownMove.quality] : null;

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
            Game Review
          </h1>
          <span style={{ fontSize: 12, color: MUTED }}>
            {review.opening ? `${review.opening} · ` : ''}Result {review.result} · White{' '}
            {review.accuracy.white}% / Black {review.accuracy.black}% accuracy
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 20,
            marginTop: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {/* ---------------- LEFT: board + eval bar + nav ------------------ */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <EvalBar cp={barCp} height={BOARD_SIZE} />
              <MiniChessBoard
                fen={currentFen}
                orientation={orientation}
                highlightUci={highlightUci}
                interactive={boardInteractive}
                onMove={boardInteractive ? handleUserMove : undefined}
                size={BOARD_SIZE}
              />
            </div>

            {/* Score readout + engine badge */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 10,
                fontSize: 12,
                color: MUTED,
              }}
            >
              <span>
                Eval{' '}
                <span style={{ color: barCp >= 0 ? '#e5e7eb' : '#fca5a5', fontWeight: 700, fontFamily: 'monospace' }}>
                  {formatScore(live.cp !== null ? live.cp : inExplore ? null : shownMove ? shownMove.evalAfter : 0, live.mate)}
                </span>{' '}
                <span style={{ color: '#4b5563' }}>({currentTurn === 'w' ? 'White' : 'Black'} to move)</span>
              </span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {analyzing && <span style={{ color: '#4b5563' }}>analysing…</span>}
                {live.engine && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 5,
                      textTransform: 'uppercase',
                      background: 'rgba(34,197,94,0.15)',
                      color: '#4ade80',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    {live.engine}
                  </span>
                )}
              </span>
            </div>

            {/* Best-move guidance for the current position */}
            <div style={{ marginTop: 6, fontSize: 12, color: MUTED, minHeight: 18 }}>
              {live.bestSan ? (
                <>
                  Engine suggests{' '}
                  <span style={{ color: ACCENT, fontWeight: 700, fontFamily: 'monospace' }}>{live.bestSan}</span>
                  {live.bestUci ? <span style={{ color: '#4b5563' }}> ({live.bestUci})</span> : null}
                </>
              ) : (
                <span style={{ color: '#4b5563' }}>No live suggestion for this position.</span>
              )}
            </div>

            {/* Navigation controls */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {!inExplore ? (
                <>
                  <button style={navBtn} onClick={goFirst} disabled={ply === 0} title="First (Home)">
                    ⏮
                  </button>
                  <button style={navBtn} onClick={goPrev} disabled={ply === 0} title="Previous (←)">
                    ◀
                  </button>
                  <button style={navBtn} onClick={goNext} disabled={ply >= lastPly} title="Next (→)">
                    ▶
                  </button>
                  <button style={navBtn} onClick={goLast} disabled={ply >= lastPly} title="Last (End)">
                    ⏭
                  </button>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginLeft: 6 }}>
                    {moveLabel}
                    <span style={{ color: MUTED, fontWeight: 400 }}>
                      {'  '}({ply}/{lastPly})
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <button style={ghostBtn} onClick={undoExplore} disabled={engineThinking} title="Take back your last move">
                    Undo move
                  </button>
                  <button style={primaryBtn} onClick={backToGame} title="Return to the reviewed game">
                    ← Back to game
                  </button>
                  {engineThinking && <span style={{ fontSize: 12, color: MUTED }}>Engine thinking…</span>}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {!inExplore && (
                <button style={primaryBtn} onClick={startExplore} title="Branch into your own line from this position">
                  Explore from here
                </button>
              )}
              <button
                style={ghostBtn}
                onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                title="Flip the board"
              >
                Flip board
              </button>
            </div>

            {inExplore && exploreMsg && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: '#4ade80',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                {exploreMsg}
              </div>
            )}
          </div>

          {/* ---------------- RIGHT: move list + detail --------------------- */}
          <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Selected-move classification detail */}
            <div style={card}>
              {shownMove && shownMeta ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>
                      {shownMove.moveNumber}
                      {shownMove.color === 'w' ? '.' : '...'} {shownMove.san}
                      {shownMeta.symbol ? (
                        <span style={{ color: shownMeta.color }}> {shownMeta.symbol}</span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: `${shownMeta.color}22`,
                        color: shownMeta.color,
                        border: `1px solid ${shownMeta.color}55`,
                      }}
                    >
                      {shownMeta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
                    Best move here:{' '}
                    <span style={{ color: ACCENT, fontWeight: 700, fontFamily: 'monospace' }}>
                      {shownMove.bestSan}
                    </span>
                    {shownMove.cpLoss > 0 && (
                      <span style={{ color: shownMeta.color }}>
                        {'  '}(−{shownMove.cpLoss} cp)
                      </span>
                    )}
                  </div>
                  {shownMove.comment && (
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{shownMove.comment}</div>
                  )}
                </>
              ) : inExplore ? (
                <div style={{ fontSize: 12, color: MUTED }}>
                  You are analysing your own line. Use “Back to game” to return to the reviewed moves.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: MUTED }}>
                  Starting position. Step forward or click a move on the right to review it.
                </div>
              )}
            </div>

            {/* Move list (two columns of SAN, clickable) */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: `1px solid ${BORDER}`,
                  fontSize: 12,
                  color: MUTED,
                  fontWeight: 600,
                }}
              >
                Moves
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.moveNumber} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td
                          style={{
                            width: 44,
                            padding: '6px 10px',
                            color: MUTED,
                            fontFamily: 'monospace',
                            textAlign: 'right',
                            userSelect: 'none',
                          }}
                        >
                          {row.moveNumber}.
                        </td>
                        <MoveCell move={row.white} activePly={inExplore ? -1 : ply} onJump={jumpTo} />
                        <MoveCell move={row.black} activePly={inExplore ? -1 : ply} onJump={jumpTo} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {review.coachingSummary && (
              <div style={{ ...card }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Coach’s summary</div>
                <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.55 }}>{review.coachingSummary}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One clickable half-move cell in the move list, colour-coded by quality. */
function MoveCell({
  move,
  activePly,
  onJump,
}: {
  move?: AnnotatedMove;
  activePly: number;
  onJump: (ply: number) => void;
}) {
  if (!move) {
    return <td style={{ padding: '6px 10px' }} />;
  }
  const meta = QUALITY_META[move.quality];
  // The move's own position on the board is at cursor `ply = move.ply + 1`
  // (positions array is fenBefore-indexed, so after this move = its index + 1).
  const targetPly = move.ply + 1;
  const isActive = activePly === targetPly;
  return (
    <td
      onClick={() => onJump(targetPly)}
      title={`${meta.label}${move.cpLoss > 0 ? ` · −${move.cpLoss}cp` : ''}`}
      style={{
        padding: '6px 10px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontWeight: 700,
        color: meta.color,
        background: isActive ? 'rgba(34,197,94,0.16)' : 'transparent',
        borderLeft: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {move.san}
      {meta.symbol ? <span style={{ opacity: 0.9 }}> {meta.symbol}</span> : null}
    </td>
  );
}
