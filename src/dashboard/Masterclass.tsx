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
import { EvalBar } from '../components/EvalBar';

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

type Tab = 'trainer' | 'random';

export function Masterclass() {
  const [tab, setTab] = useState<Tab>('trainer');
  const [startEgId, setStartEgId] = useState<string | undefined>(undefined);

  return (
    <div style={{ color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
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
          <TabButton active={tab === 'trainer'} onClick={() => setTab('trainer')}>
            Syzygy Endgame Trainer
          </TabButton>
          <TabButton active={tab === 'random'} onClick={() => setTab('random')}>
            Randomized Endgame
          </TabButton>
        </div>

        {tab === 'random' ? (
          <RandomEndgames onPlay={(fen) => {
            const custom = ENDGAMES.find((e) => e.id === 'custom');
            if (custom) custom.fen = fen;
            setStartEgId('custom');
            setTab('trainer');
          }} />
        ) : (
          <SyzygyTrainer startEgId={startEgId} />
        )}
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

/* ─────────────────────────────── Random Endgames ──────────────────────────────── */

function generateRandomEndgame(totalPieces: number, mustHave: string[] = []): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const board = Array(64).fill(null);
    const emptySquares = () => board.map((_, i) => i).filter((i) => board[i] === null);
    
    const wkSq = Math.floor(Math.random() * 64);
    board[wkSq] = 'K';
    
    const illegalBkSquares = new Set([
      wkSq, wkSq-1, wkSq+1, wkSq-8, wkSq+8, wkSq-9, wkSq-7, wkSq+7, wkSq+9
    ]);
    const validBkSquares = emptySquares().filter((sq) => !illegalBkSquares.has(sq));
    if (validBkSquares.length === 0) continue;
    const bkSq = validBkSquares[Math.floor(Math.random() * validBkSquares.length)];
    board[bkSq] = 'k';
    
    const piecesRemaining = totalPieces - 2;
    const pool = ['Q', 'R', 'B', 'N', 'P', 'q', 'r', 'b', 'n', 'p'];
    const chosenPieces: string[] = [...mustHave];
    while (chosenPieces.length < piecesRemaining) {
      chosenPieces.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    
    let badPlacement = false;
    for (const p of chosenPieces) {
      const isPawn = p.toLowerCase() === 'p';
      let available = emptySquares();
      if (isPawn) available = available.filter((sq) => sq >= 8 && sq <= 55);
      if (available.length === 0) { badPlacement = true; break; }
      const sq = available[Math.floor(Math.random() * available.length)];
      board[sq] = p;
    }
    if (badPlacement) continue;
    
    let fen = '';
    for (let r = 7; r >= 0; r--) {
      let emptyCount = 0;
      for (let f = 0; f < 8; f++) {
        const sq = r * 8 + f;
        const p = board[sq];
        if (p) {
          if (emptyCount > 0) fen += emptyCount;
          fen += p;
          emptyCount = 0;
        } else emptyCount++;
      }
      if (emptyCount > 0) fen += emptyCount;
      if (r > 0) fen += '/';
    }
    fen += ' w - - 0 1';
    
    try {
      new Chess(fen);
      return fen;
    } catch {
      continue;
    }
  }
  return '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
}

function RandomEndgames({ onPlay }: { onPlay: (fen: string) => void }) {
  const [totalPieces, setTotalPieces] = useState(3);
  const [mustHaveQ, setMustHaveQ] = useState(false);
  const [mustHaveR, setMustHaveR] = useState(false);
  const [mustHaveP, setMustHaveP] = useState(false);
  const [fen, setFen] = useState('8/8/8/4k3/8/8/4K3/8 w - - 0 1');

  const generate = () => {
    const must = [];
    if (mustHaveQ) must.push(Math.random() > 0.5 ? 'Q' : 'q');
    if (mustHaveR) must.push(Math.random() > 0.5 ? 'R' : 'r');
    if (mustHaveP) must.push(Math.random() > 0.5 ? 'P' : 'p');
    if (must.length > totalPieces - 2) {
      alert(`You asked for ${must.length} required pieces, but total pieces is set to ${totalPieces} (which includes 2 kings). Please increase total pieces or reduce filters.`);
      return;
    }
    setFen(generateRandomEndgame(totalPieces, must));
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{...card}}>
           <h2 style={{fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8}}>Randomized Endgame Generator</h2>
           <div style={{fontSize: 13, color: MUTED, marginBottom: 16}}>
             Generate a random valid chess position with up to 7 pieces to test your endgame intuition against the perfect tablebase.
           </div>
           
           <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4}}>Total Pieces (including Kings)</label>
           <input 
             type="range" 
             min={3} max={7} 
             value={totalPieces} 
             onChange={(e) => setTotalPieces(parseInt(e.target.value))} 
             style={{width: '100%', marginBottom: 16}} 
           />
           <div style={{textAlign: 'center', fontSize: 14, fontWeight: 700, marginTop: -12, marginBottom: 16}}>{totalPieces}</div>

           <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8}}>Filters (Must Have)</label>
           <div style={{display: 'flex', gap: 12, marginBottom: 24}}>
             <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer'}}>
               <input type="checkbox" checked={mustHaveQ} onChange={e => setMustHaveQ(e.target.checked)} style={{accentColor: ACCENT}} /> Queen
             </label>
             <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer'}}>
               <input type="checkbox" checked={mustHaveR} onChange={e => setMustHaveR(e.target.checked)} style={{accentColor: ACCENT}} /> Rook
             </label>
             <label style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer'}}>
               <input type="checkbox" checked={mustHaveP} onChange={e => setMustHaveP(e.target.checked)} style={{accentColor: ACCENT}} /> Pawn
             </label>
           </div>

           <button style={{...primaryBtn, width: '100%'}} onClick={generate}>Generate Random Position</button>
        </div>
      </div>
      <div style={{ flex: '0 0 auto', maxWidth: '100%' }}>
         <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: PANEL_ALT }}>
           <MiniChessBoard fen={fen} interactive={false} size={460} />
         </div>
         <button style={{...primaryBtn, width: '100%', marginTop: 12}} onClick={() => onPlay(fen)}>
           Play This Position in Trainer &rsaquo;
         </button>
      </div>
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
  {
    id: 'custom',
    name: 'Custom Setup',
    blurb: 'Set up your own custom endgame position with up to 7 pieces.',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
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

function setPieceInFen(fen: string, sq: string, piece: { type: string; color: 'w' | 'b' } | null): string {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const r = 8 - parseInt(sq[1], 10);
  const c = sq.charCodeAt(0) - 97;
  
  let rowStr = rows[r];
  let expanded = '';
  for (let i = 0; i < rowStr.length; i++) {
    if (isNaN(parseInt(rowStr[i], 10))) {
      expanded += rowStr[i];
    } else {
      expanded += ' '.repeat(parseInt(rowStr[i], 10));
    }
  }
  const char = piece ? (piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()) : ' ';
  expanded = expanded.substring(0, c) + char + expanded.substring(c + 1);
  
  let compressed = '';
  let spaces = 0;
  for (let i = 0; i < 8; i++) {
    if (expanded[i] === ' ') spaces++;
    else {
      if (spaces > 0) { compressed += spaces; spaces = 0; }
      compressed += expanded[i];
    }
  }
  if (spaces > 0) compressed += spaces;
  rows[r] = compressed;
  parts[0] = rows.join('/');
  return parts.join(' ');
}

const GLYPHS: Record<string, string> = {
  wk: '♚', wq: '♛', wr: '♜', wb: '♝', wn: '♞', wp: '♟',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

function PieceIcon({ type, color, size = 40 }: { type: string; color: 'w' | 'b'; size?: number }) {
  const glyph = GLYPHS[color + type];
  return (
    <div style={{
      width: size, height: size, fontSize: size * 0.8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: color === 'w' ? '#ffffff' : '#111827',
      textShadow: color === 'w' ? '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)' : '0 1px 3px rgba(255,255,255,0.4)',
    }}>
      {glyph}
    </div>
  );
}

function BoardEditor({ initialFen, onPlay }: { initialFen: string; onPlay: (fen: string) => void }) {
  const [fen, setFen] = useState(initialFen);
  const [equipped, setEquipped] = useState<{ type: string; color: 'w' | 'b' } | null>(null);

  const turn = fen.split(' ')[1] || 'w';
  const toggleTurn = () => {
    const parts = fen.split(' ');
    parts[1] = turn === 'w' ? 'b' : 'w';
    setFen(parts.join(' '));
  };

  const handleSquareClick = (sq: string) => {
    setFen(setPieceInFen(fen, sq, equipped));
  };

  const palette = (color: 'w' | 'b') => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12, marginTop: 12 }}>
      {['K', 'Q', 'R', 'B', 'N', 'P'].map((t) => {
        const type = t.toLowerCase();
        const active = equipped?.type === type && equipped?.color === color;
        return (
          <button
            key={type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({ type, color }));
              setEquipped({ type, color });
            }}
            onClick={() => setEquipped(active ? null : { type, color })}
            style={{
              background: active ? 'rgba(34,197,94,0.2)' : PANEL,
              border: `2px solid ${active ? ACCENT : BORDER}`,
              borderRadius: 8, padding: 4, cursor: 'grab',
            }}
          >
            <PieceIcon type={type} color={color} size={36} />
          </button>
        );
      })}
      {color === 'w' && (
        <button
          onClick={() => setEquipped(null)}
          style={{ ...ghostBtn, marginLeft: 16, borderColor: !equipped ? ACCENT : BORDER }}
        >
          🗑️ Eraser
        </button>
      )}
    </div>
  );

  const handlePlay = () => {
    try {
      const g = new Chess(fen);
      if (g.isGameOver()) {
        alert("The position is already game over (checkmate or draw)!");
        return;
      }
      onPlay(fen);
    } catch (e) {
      alert("Invalid FEN position! Make sure both kings are present, no pawns are on the 1st/8th ranks, and the position is legal.");
    }
  };

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', background: PANEL_ALT }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, width: '100%', flexWrap: 'wrap' }}>
        <button style={{...ghostBtn, flexShrink: 0}} onClick={toggleTurn}>
          {turn === 'w' ? '⚪ White to move' : '⚫ Black to move'}
        </button>
        <input
          value={fen}
          onChange={(e) => setFen(e.target.value)}
          placeholder="Paste FEN here..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: PANEL, color: TEXT, fontSize: 13, outline: 'none' }}
        />
        <button style={{...primaryBtn, flexShrink: 0}} onClick={handlePlay}>Start Training &rsaquo;</button>
      </div>
      {palette('b')}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        <MiniChessBoard 
          fen={fen} 
          onSquareClick={handleSquareClick} 
          onSquareDrop={(sq, piece) => setFen(setPieceInFen(fen, sq, piece))}
          interactive={false} 
          size={460} 
        />
      </div>
      {palette('w')}
      <div style={{ fontSize: 12, color: MUTED, marginTop: 8, textAlign: 'center' }}>
        Drag pieces onto the board or click to place them. Use the Eraser to remove pieces.<br/>Max 7 pieces total for tablebase analysis.
      </div>
    </div>
  );
}

function SyzygyTrainer({ startEgId }: { startEgId?: string }) {
  const [egId, setEgId] = useState<string>(startEgId ?? ENDGAMES[0].id);
  const [showBestMove, setShowBestMove] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const endgame = ENDGAMES.find((e) => e.id === egId) ?? ENDGAMES[0];

  useEffect(() => {
    if (startEgId) setEgId(startEgId);
  }, [startEgId]);

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
  const [fens, setFens] = useState<string[]>([endgame.fen]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  // Guards against out-of-order async probes (rapid moves / endgame switches).
  const probeSeq = useRef(0);

  const resetTo = useCallback((fenStr: string) => {
    setFen(fenStr);
    setResult(null);
    setHint(null);
    setApiFailed(false);
    setMoveError(null);
    setHistory([]);
    setFens([fenStr]);
    setCurrentMoveIndex(0);
    setStatus('idle');
  }, []);

  const [isEditing, setIsEditing] = useState(false);

  // When the chosen endgame changes, reset the board to its start.
  useEffect(() => {
    if (endgame.id === 'custom') {
      setIsEditing(true);
      resetTo(endgame.fen);
    } else {
      setIsEditing(false);
      resetTo(endgame.fen);
    }
  }, [endgame.id, resetTo]);

  /**
   * Probe the given position and, when it's the opponent's turn, auto-play the
   * tablebase's best reply. Always refreshes the status/hint for whatever
   * position we end up on when it's the human's turn.
   */
  const advance = useCallback(
    async (positionFen: string, autoPlay = true) => {
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

      if (sideToMove === humanColor || !autoPlay) {
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
      setFens((f) => [...f, nextFen]);
      setCurrentMoveIndex((idx) => idx + 1);

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

      let newIdx = 0;
      setHistory((h) => {
        const sliced = h.slice(0, currentMoveIndex);
        newIdx = sliced.length + 1;
        return [...sliced, san];
      });
      setFens((f) => {
        const sliced = f.slice(0, currentMoveIndex + 1);
        return [...sliced, nextFen];
      });
      setCurrentMoveIndex(() => newIdx);
      setFen(nextFen);
      setHint(null);
      void advance(nextFen);
    },
    [fen, humanColor, advance, currentMoveIndex],
  );

  const handleScrub = (delta: number) => {
    const newIdx = Math.max(0, Math.min(history.length, currentMoveIndex + delta));
    if (newIdx !== currentMoveIndex) {
      setCurrentMoveIndex(newIdx);
      const targetFen = fens[newIdx];
      setFen(targetFen);
      probeSeq.current++;
      setResult(null);
      setHint(null);
      void advance(targetFen, false);
    }
  };

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

  let currentCp = 0;
  if (result) {
    if (result.category === 'win') currentCp = humanColor === 'w' ? 1000 : -1000;
    else if (result.category === 'loss') currentCp = humanColor === 'w' ? -1000 : 1000;
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      
      {/* LEFT COLUMN: Controls, Text, Status */}
      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        {/* Endgame picker */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{endgame.name}</div>
             {endgame.id === 'custom' && !isEditing && (
               <button style={{...ghostBtn, padding: '4px 10px', fontSize: 11}} onClick={() => setIsEditing(true)}>Edit Board</button>
             )}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{endgame.blurb}</div>
          {!isEditing && (
            <div style={{ fontSize: 12, color: MUTED }}>
              You play {humanColor === 'w' ? 'White' : 'Black'}. Make your move; a perfect opponent
              replies from the tablebase.
            </div>
          )}
        </div>

        {!isEditing && (
          <>
            <div style={{ ...card }}>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ ...ghostBtn, padding: '4px 10px', fontSize: 14 }}
                  onClick={() => handleScrub(-1)}
                  disabled={currentMoveIndex === 0}
                >
                  &lsaquo;
                </button>
                <button
                  style={{ ...ghostBtn, padding: '4px 10px', fontSize: 14 }}
                  onClick={() => handleScrub(1)}
                  disabled={currentMoveIndex === history.length}
                >
                  &rsaquo;
                </button>
              </div>
              <button style={ghostBtn} onClick={() => resetTo(endgame.fen)}>
                Reset
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
                {history.length > 0
                  ? history.map((san, i) => (
                      <span
                        key={i}
                        style={{
                          color: i < currentMoveIndex ? TEXT : MUTED,
                          fontWeight: i === currentMoveIndex - 1 ? 700 : 400,
                          marginRight: 6,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleScrub(i + 1 - currentMoveIndex)}
                      >
                        {san}
                      </span>
                    ))
                  : 'No moves yet.'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Board / Editor */}
      <div style={{ flex: '0 0 auto', maxWidth: '100%' }}>
        {isEditing ? (
          <BoardEditor 
            initialFen={endgame.fen} 
            onPlay={(customFen) => {
              setIsEditing(false);
              setFen(customFen);
              void advance(customFen);
            }} 
          />
        ) : (
          <div style={{ display: 'flex', gap: 16 }}>
            <EvalBar cp={currentCp} height={460} />
            <div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: PANEL_ALT }}>
                <MiniChessBoard
                  fen={fen}
                  orientation={humanColor}
                  interactive={humansTurn}
                  onMove={onHumanMove}
                  highlightUci={humansTurn && hint ? hint.uci : null}
                  suggestedMoveUci={humansTurn && hint && showBestMove ? hint.uci : null}
                  size={460}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showBestMove}
                    onChange={(e) => setShowBestMove(e.target.checked)}
                    style={{ accentColor: ACCENT, cursor: 'pointer' }}
                  />
                  Show best move
                </label>
                <button style={{ ...ghostBtn, padding: '4px 12px', fontSize: 12 }} onClick={() => setIsFullscreen(true)}>
                  [ ⛶ Maximize ]
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isFullscreen && !isEditing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: 'absolute', top: 24, right: 32,
              background: 'transparent', border: 'none', color: '#fff', fontSize: 36, cursor: 'pointer',
            }}
          >
            &times;
          </button>
          <div style={{ display: 'flex', gap: 24 }}>
            <EvalBar cp={currentCp} height={Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 800)} />
            <MiniChessBoard
              fen={fen}
              orientation={humanColor}
              interactive={humansTurn}
              onMove={onHumanMove}
              highlightUci={humansTurn && hint ? hint.uci : null}
              suggestedMoveUci={humansTurn && hint && showBestMove ? hint.uci : null}
              size={Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 800)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
