import { useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';

/**
 * A small, self-contained, click-to-move chess board rendered straight from a
 * FEN string. It depends only on React + chess.js — no images, no external
 * board library — drawing pieces with unicode glyphs on a classic two-tone
 * board.
 *
 * Interaction model (when {@link MiniChessBoardProps.interactive} and an
 * {@link MiniChessBoardProps.onMove} handler are supplied):
 *   1. Click a piece belonging to the side to move → its legal target squares
 *      light up (computed via `chess.moves({ square, verbose: true })`).
 *   2. Click one of those targets → we call `onMove({ from, to, promotion })`.
 *      Promotions auto-queen (`promotion: 'q'`) so the drill keeps flowing.
 *   3. Clicking the same piece again, or an empty/illegal square, clears the
 *      selection.
 *
 * The component is intentionally stateless about the game itself: it always
 * reflects whatever FEN it is handed, so the parent owns the single source of
 * truth. Illegal-move handling lives with the parent; here we only ever offer
 * squares chess.js reported as legal.
 */

// Unicode glyphs. White pieces first, then black.
const GLYPHS: Record<string, string> = {
  wk: '♔',
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  wp: '♙',
  bk: '♚',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
  bp: '♟',
};

const LIGHT = '#ebecd0';
const DARK = '#779556';
const SELECTED = 'rgba(34,197,94,0.55)';
const HIGHLIGHT = 'rgba(250,204,21,0.55)'; // for highlightUci (last move etc.)
const TARGET_DOT = 'rgba(34,197,94,0.9)';
const CAPTURE_RING = 'rgba(34,197,94,0.85)';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export interface MiniChessBoardProps {
  fen: string;
  onMove?: (move: { from: string; to: string; promotion?: string }) => void;
  orientation?: 'w' | 'b';
  /** A UCI string like "e2e4"; its from/to squares get a subtle highlight. */
  highlightUci?: string | null;
  interactive?: boolean;
  /** Pixel size of the whole board (default 320). */
  size?: number;
}

/** True when a pawn move reaches the last rank (so it must promote). */
function isPromotion(chess: Chess, from: string, to: string): boolean {
  try {
    const piece = chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const toRank = to[1];
    return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
  } catch {
    return false;
  }
}

export function MiniChessBoard({
  fen,
  onMove,
  orientation = 'w',
  highlightUci = null,
  interactive = true,
  size = 320,
}: MiniChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Parse the FEN once per render into an 8x8 grid. chess.js returns row 0 =
  // rank 8, so board[r][c] maps directly to file c (a..h), rank (8 - r).
  const { board, legalTargets, turn } = useMemo(() => {
    let game: Chess;
    try {
      game = new Chess(fen);
    } catch {
      game = new Chess();
    }
    const grid = game.board();
    const targets = new Set<string>();
    if (interactive && selected) {
      try {
        const moves = game.moves({ square: selected as Square, verbose: true });
        for (const m of moves) targets.add(m.to);
      } catch {
        /* selected square had no piece / not side to move — no targets */
      }
    }
    return { board: grid, legalTargets: targets, turn: game.turn() };
  }, [fen, selected, interactive]);

  const highlightFrom = highlightUci ? highlightUci.slice(0, 2) : null;
  const highlightTo = highlightUci ? highlightUci.slice(2, 4) : null;

  // Row/column order depends on orientation. White at bottom = ranks 8→1 top to
  // bottom (chess.js native order); flipping reverses both axes.
  const rows = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  function squareName(r: number, c: number): string {
    // r is the chess.js grid row (0 = rank 8). File = c, rank = 8 - r.
    return `${FILES[c]}${8 - r}`;
  }

  function handleSquareClick(sq: string, piece: { type: string; color: 'w' | 'b' } | null) {
    if (!interactive || !onMove) return;

    // Clicking a legal target of the currently-selected piece → make the move.
    if (selected && legalTargets.has(sq)) {
      let game: Chess;
      try {
        game = new Chess(fen);
      } catch {
        game = new Chess();
      }
      const promotion = isPromotion(game, selected, sq) ? 'q' : undefined;
      const move = promotion ? { from: selected, to: sq, promotion } : { from: selected, to: sq };
      setSelected(null);
      onMove(move);
      return;
    }

    // Clicking the already-selected square deselects it.
    if (selected === sq) {
      setSelected(null);
      return;
    }

    // Selecting a piece of the side to move highlights its targets.
    if (piece && piece.color === turn) {
      setSelected(sq);
      return;
    }

    // Anything else clears the selection.
    setSelected(null);
  }

  const cell = size / 8;
  const glyphSize = Math.round(cell * 0.72);
  const coordSize = Math.max(8, Math.round(cell * 0.2));

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: `repeat(8, 1fr)`,
        gridTemplateRows: `repeat(8, 1fr)`,
        border: '2px solid #3b3b33',
        borderRadius: 6,
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
      }}
    >
      {rows.map((r) =>
        cols.map((c) => {
          const sq = squareName(r, c);
          const piece = board[r][c];
          const isLight = (r + c) % 2 === 0;
          const isSelected = selected === sq;
          const isTarget = legalTargets.has(sq);
          const isHi = sq === highlightFrom || sq === highlightTo;
          const canGrab = interactive && !!onMove && !!piece && piece.color === turn;

          // Bottom-left square shows the file letter; left column shows the rank.
          const showFile = orientation === 'w' ? r === 7 : r === 0;
          const showRank = orientation === 'w' ? c === 0 : c === 7;

          let background = isLight ? LIGHT : DARK;
          if (isHi) background = HIGHLIGHT;
          if (isSelected) background = SELECTED;

          return (
            <div
              key={sq}
              onClick={() => handleSquareClick(sq, piece)}
              style={{
                position: 'relative',
                background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canGrab || (isTarget && selected) ? 'pointer' : 'default',
              }}
            >
              {/* Legal-move indicator: dot on empty squares, ring on captures. */}
              {isTarget &&
                (piece ? (
                  <span
                    style={{
                      position: 'absolute',
                      inset: '8%',
                      borderRadius: '50%',
                      border: `${Math.max(2, Math.round(cell * 0.09))}px solid ${CAPTURE_RING}`,
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      position: 'absolute',
                      width: cell * 0.3,
                      height: cell * 0.3,
                      borderRadius: '50%',
                      background: TARGET_DOT,
                    }}
                  />
                ))}

              {piece && (
                <span
                  style={{
                    fontSize: glyphSize,
                    lineHeight: 1,
                    color: piece.color === 'w' ? '#f8fafc' : '#111827',
                    textShadow:
                      piece.color === 'w'
                        ? '0 1px 1px rgba(0,0,0,0.55)'
                        : '0 1px 1px rgba(255,255,255,0.25)',
                    position: 'relative',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  {GLYPHS[`${piece.color}${piece.type}`]}
                </span>
              )}

              {showFile && (
                <span
                  style={{
                    position: 'absolute',
                    right: 2,
                    bottom: 1,
                    fontSize: coordSize,
                    fontWeight: 700,
                    color: isLight ? DARK : LIGHT,
                    opacity: 0.8,
                    pointerEvents: 'none',
                  }}
                >
                  {FILES[c]}
                </span>
              )}
              {showRank && (
                <span
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: 1,
                    fontSize: coordSize,
                    fontWeight: 700,
                    color: isLight ? DARK : LIGHT,
                    opacity: 0.8,
                    pointerEvents: 'none',
                  }}
                >
                  {8 - r}
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
