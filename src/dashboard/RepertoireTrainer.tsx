import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { MiniChessBoard } from '../components/MiniChessBoard';
import { EvalBar } from '../components/EvalBar';
import { requestEngineAnalysis } from '../engine/stockfish';
import { OPENING_CATALOG, type CatalogOpening } from '../data/openingCatalog';

const ACCENT = '#22c55e';
const PANEL = '#0f172a';
const PANEL_ALT = '#111827';
const BORDER = '#1f2937';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';

const START_FEN = new Chess().fen();

const FALLBACK_PREFS = [
  'e5', 'e6', 'c5', 'd5', 'c6', 'Nf6', 'Nc6', 'g6', 'd6',
  'e4', 'd4', 'Nf3', 'c4', 'Nc3', 'g3',
  'Be7', 'Bc5', 'Bb4', 'Bg7', 'Bf5', 'O-O',
];

type EngineBadge = 'stockfish' | 'builtin' | 'fallback' | null;
type SideFilter = 'all' | 'w' | 'b';

interface HistoryEntry {
  san: string;
  by: 'book' | 'you' | 'engine';
  fen: string;
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

function fallbackReply(game: Chess): string | null {
  const legal = game.moves();
  if (legal.length === 0) return null;
  for (const pref of FALLBACK_PREFS) {
    if (legal.includes(pref)) return pref;
  }
  const developing = legal.find((m) => /^N[a-h][1-8]$/.test(m) || /^B[a-h][1-8]$/.test(m));
  return developing ?? legal[0];
}

function sideLabel(side: CatalogOpening['side']): string {
  return side === 'w' ? 'White' : side === 'b' ? 'Black' : 'Either';
}

export function RepertoireTrainer() {
  const [query, setQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Board / game state ─────────────────────────────────────────────────────
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [engineBadge, setEngineBadge] = useState<EngineBadge>(null);
  const [thinking, setThinking] = useState(false);

  // ── UI Features ─────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBestMove, setShowBestMove] = useState(false);
  const [latestAnalysisLine, setLatestAnalysisLine] = useState<{ uci: string; cp: number; mate: number | null } | null>(null);
  const [evalCp, setEvalCp] = useState(0);

  const lineToken = useRef(0);
  const evalToken = useRef(0);

  const selected = useMemo(
    () => OPENING_CATALOG.find((o) => o.id === selectedId) ?? null,
    [selectedId],
  );

  const currentFen = currentMoveIndex >= 0 && history[currentMoveIndex] ? history[currentMoveIndex].fen : START_FEN;

  const game = useMemo(() => {
    try {
      return new Chess(currentFen);
    } catch {
      return new Chess();
    }
  }, [currentFen]);

  const gameOver = game.isGameOver();
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
    if (gameOver) {
      setLatestAnalysisLine(null);
      return;
    }
    evalToken.current += 1;
    const token = evalToken.current;
    const fenToAnalyse = currentFen;

    const timer = setTimeout(() => {
      void (async () => {
        let cp = 0;
        let topAnalysis = null;
        try {
          const analysis = await requestEngineAnalysis(fenToAnalyse, 1, 16);
          if (analysis && analysis.lines.length > 0) {
            topAnalysis = analysis.lines[0];
            let whiteCp: number;
            if (topAnalysis.mate !== null) {
              const sign = topAnalysis.mate >= 0 ? 1 : -1;
              whiteCp = sign * 10000;
            } else {
              whiteCp = topAnalysis.cp;
            }
            let stm: 'w' | 'b' = 'w';
            try {
              stm = new Chess(fenToAnalyse).turn();
            } catch {
              stm = 'w';
            }
            if (stm === 'b') whiteCp = -whiteCp;
            cp = whiteCp;
          }
        } catch {
          cp = 0;
        }
        if (token !== evalToken.current) return;
        setLatestAnalysisLine(topAnalysis);
        setEvalCp(cp);
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [currentFen, gameOver]);

  /** Load an opening: auto-play its book line, orient the board, enter practice. */
  const startOpening = useCallback((op: CatalogOpening) => {
    lineToken.current += 1;
    const g = new Chess();
    const played: HistoryEntry[] = [];
    for (const san of op.moves) {
      try {
        const m = g.move(san);
        played.push({ san: m.san, by: 'book', fen: g.fen() });
      } catch {
        break;
      }
    }
    const side: 'w' | 'b' = op.side === 'b' ? 'b' : 'w';
    setSelectedId(op.id);
    setOrientation(side);
    setHistory(played);
    setCurrentMoveIndex(played.length - 1);
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setEvalCp(0);
    setLatestAnalysisLine(null);
  }, []);

  const resetBoard = useCallback(() => {
    if (selected) {
      startOpening(selected);
      return;
    }
    lineToken.current += 1;
    setHistory([]);
    setCurrentMoveIndex(-1);
    setLastUci(null);
    setEngineBadge(null);
    setThinking(false);
    setEvalCp(0);
    setLatestAnalysisLine(null);
  }, [selected, startOpening]);

  const flipBoard = useCallback(() => {
    setOrientation((o) => (o === 'w' ? 'b' : 'w'));
  }, []);

  async function playEngineReply(afterUserFen: string, token: number, indexBeforeReply: number) {
    setThinking(true);
    let badge: EngineBadge = 'fallback';
    let chosenUci: string | null = null;

    try {
      const analysis = await requestEngineAnalysis(afterUserFen, 1, 16);
      if (analysis && analysis.lines.length > 0) {
        chosenUci = analysis.lines[0].uci;
        badge = analysis.engine;
      }
    } catch {
      chosenUci = null;
    }

    if (token !== lineToken.current) return;

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
      setLastUci(chosenUci && badge !== 'fallback' ? chosenUci : null);
      setHistory((prev) => {
        const sliced = prev.slice(0, indexBeforeReply + 1);
        const newHist = [...sliced, { san: played!.san, by: 'engine' as const, fen: reply.fen() }];
        setCurrentMoveIndex(newHist.length - 1);
        return newHist;
      });
    }
  }

  function handleUserMove(move: { from: string; to: string; promotion?: string }) {
    if (!selected || !yourTurn) return;

    let next: Chess;
    try {
      next = new Chess(currentFen);
    } catch {
      return;
    }

    let played: { san: string } | null = null;
    try {
      played = next.move(move);
    } catch {
      played = null;
    }
    if (!played) return;

    const token = lineToken.current;
    setLastUci(`${move.from}${move.to}`);
    
    // We compute the new index safely out here because state updates are batched/async, 
    // and playEngineReply needs the correct target index immediately.
    const targetIndexBeforeReply = currentMoveIndex + 1;
    
    setHistory((prev) => {
      const sliced = prev.slice(0, currentMoveIndex + 1);
      const newHist = [...sliced, { san: played!.san, by: 'you' as const, fen: next.fen() }];
      return newHist;
    });
    setCurrentMoveIndex(targetIndexBeforeReply);

    if (!next.isGameOver()) {
      void playEngineReply(next.fen(), token, targetIndexBeforeReply);
    }
  }

  const movePairs = useMemo(() => {
    const pairs: Array<{ no: number; white?: HistoryEntry; black?: HistoryEntry; whiteIndex: number; blackIndex?: number }> = [];
    history.forEach((h, i) => {
      const no = Math.floor(i / 2) + 1;
      if (i % 2 === 0) pairs.push({ no, white: h, whiteIndex: i });
      else {
        pairs[pairs.length - 1].black = h;
        pairs[pairs.length - 1].blackIndex = i;
      }
    });
    return pairs;
  }, [history]);

  // Use window size for fullscreen, otherwise 500
  const winMin = typeof window !== 'undefined' ? Math.min(window.innerHeight, window.innerWidth) : 800;
  const boardSize = isFullscreen ? Math.max(300, winMin * 0.85) : 500;
  const canGoBack = currentMoveIndex >= 0;
  const canGoForward = currentMoveIndex < history.length - 1;

  const controlsRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', gap: 4, background: PANEL_ALT, padding: 4, borderRadius: 8, border: `1px solid ${BORDER}` }}>
        <button 
          onClick={() => setCurrentMoveIndex(i => Math.max(-1, i - 1))}
          disabled={!canGoBack}
          style={{ ...ghostBtn, padding: '4px 12px', opacity: canGoBack ? 1 : 0.4 }}
          title="Previous move"
        >
          ◀
        </button>
        <button 
          onClick={() => setCurrentMoveIndex(i => Math.min(history.length - 1, i + 1))}
          disabled={!canGoForward}
          style={{ ...ghostBtn, padding: '4px 12px', opacity: canGoForward ? 1 : 0.4 }}
          title="Next move"
        >
          ▶
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={showBestMove} 
          onChange={e => setShowBestMove(e.target.checked)} 
          style={{ cursor: 'pointer' }}
        />
        Show best move
      </label>

      <div style={{ flex: 1 }} />

      {!isFullscreen && (
        <button style={ghostBtn} onClick={() => setIsFullscreen(true)} title="Maximize Board">
          ⛶ Maximize
        </button>
      )}
      <button style={ghostBtn} onClick={flipBoard}>Flip</button>
      <button style={ghostBtn} onClick={resetBoard}>Reset</button>
    </div>
  );

  const statusRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
      <StatusBadge
        selected={!!selected}
        yourTurn={yourTurn}
        thinking={thinking}
        gameOver={gameOver}
        game={game}
        playAs={playAs}
      />
      {selected && !yourTurn && !thinking && !gameOver && (
        <button
          onClick={() => void playEngineReply(currentFen, lineToken.current, currentMoveIndex)}
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            border: 'none',
            background: `linear-gradient(135deg, #4ade80, #22c55e)`,
            color: '#0b1120',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(34,197,94,0.4)',
          }}
        >
          Start Practice (Stockfish plays {game.turn() === 'w' ? 'White' : 'Black'})
        </button>
      )}
      <EngineChip badge={engineBadge} />
      <span
        style={{
          fontSize: 12,
          color: MUTED,
          fontFamily: 'monospace',
          marginLeft: 'auto',
        }}
        title="Evaluation (White POV)"
      >
        {evalCp >= 0 ? '+' : ''}
        {(evalCp / 100).toFixed(1)}
      </span>
    </div>
  );

  const boardContent = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <EvalBar cp={evalCp} height={boardSize} />
      <MiniChessBoard
        fen={currentFen}
        orientation={orientation}
        onMove={handleUserMove}
        interactive={yourTurn}
        highlightUci={lastUci}
        suggestedMoveUci={showBestMove && latestAnalysisLine ? latestAnalysisLine.uci : null}
        size={boardSize}
      />
    </div>
  );

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif', width: '100%' }}>
      {isFullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5,9,20,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <button 
            onClick={() => setIsFullscreen(false)} 
            style={{ 
              position: 'absolute', top: 24, right: 32, fontSize: 32, color: '#e5e7eb', 
              background: 'transparent', border: 'none', cursor: 'pointer',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
            title="Close Fullscreen"
          >
            ✕
          </button>
          {boardContent}
          <div style={{ width: boardSize + 40, maxWidth: '100%' }}>
             {controlsRow}
             {statusRow}
          </div>
        </div>
      )}

      <div style={{ width: '100%', boxSizing: 'border-box', padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: ACCENT, margin: '0 0 4px 0' }}>
          Opening Trainer
        </h1>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px 0' }}>
          Search any well-known opening, watch it play out on a full-size board with a live
          evaluation bar, study its ideas, then play the line on against Stockfish.
        </p>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ─────────────── LEFT: board + eval bar ─────────────── */}
          <div style={{ flex: '0 0 auto' }}>
            {boardContent}
            {controlsRow}
            {statusRow}

            {selected && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                You play {sideLabel(playAs)} · engine answers for the other side.
              </div>
            )}
          </div>

          {/* ─────────────── RIGHT: opening list + theory ─────────────── */}
          <div style={{ flex: '1 1 380px', minWidth: 320, display: 'grid', gap: 16 }}>
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
                        {p.white && (
                          <button 
                            onClick={() => setCurrentMoveIndex(p.whiteIndex)}
                            style={{ 
                              background: 'transparent', border: 'none', padding: 0, margin: 0, 
                              cursor: 'pointer', opacity: currentMoveIndex === p.whiteIndex ? 1 : 0.6 
                            }}
                          >
                            <MovePill entry={p.white} active={currentMoveIndex === p.whiteIndex} />
                          </button>
                        )}
                        {p.black && (
                          <button 
                            onClick={() => setCurrentMoveIndex(p.blackIndex!)}
                            style={{ 
                              background: 'transparent', border: 'none', padding: 0, margin: 0, 
                              cursor: 'pointer', opacity: currentMoveIndex === p.blackIndex ? 1 : 0.6 
                            }}
                          >
                            <MovePill entry={p.black} active={currentMoveIndex === p.blackIndex} />
                          </button>
                        )}
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
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
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

function MovePill({ entry, active }: { entry: HistoryEntry, active: boolean }) {
  const isYou = entry.by === 'you';
  const isBook = entry.by === 'book';
  return (
    <span
      title={isYou ? 'Your move' : isBook ? 'Opening line' : 'Engine reply'}
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: active ? 'rgba(56,189,248,0.2)' : isYou ? 'rgba(34,197,94,0.15)' : isBook ? 'rgba(148,163,184,0.12)' : PANEL,
        color: active ? '#38bdf8' : isYou ? '#4ade80' : TEXT,
        border: `1px solid ${active ? '#38bdf8' : BORDER}`,
        transition: 'all 0.15s ease',
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
