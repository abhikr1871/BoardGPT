import { Chess } from 'chess.js';

/**
 * A small but genuine chess engine: negamax + alpha-beta over chess.js with a
 * material + piece-square-table evaluation. It is intentionally lightweight so
 * it runs instantly in the browser and needs no WASM/headers. Stockfish is the
 * preferred engine (see stockfish.ts); this is the always-available fallback
 * and what the working demo uses out of the box.
 */

export interface RawLine {
  uci: string;
  san: string;
  cp: number; // centipawns, side-to-move POV
  mate: number | null;
}

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Piece-square tables (white POV, a8..h1 reading order = rank 8 first).
// Values are small positional nudges in centipawns.
// prettier-ignore
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

const MATE = 100000;

/** Static evaluation in centipawns from White's perspective. */
function evaluateBoard(chess: Chess): number {
  const board = chess.board(); // 8x8, row 0 = rank 8
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const idx = r * 8 + f;
      const base = PIECE_VALUE[sq.type];
      const pst = PST[sq.type];
      if (sq.color === 'w') {
        score += base + pst[idx];
      } else {
        // Mirror the table vertically for black.
        const mirrored = (7 - r) * 8 + f;
        score -= base + pst[mirrored];
      }
    }
  }
  return score;
}

/** Quiescence search to resolve captures before evaluating. Limited to 3 plies to prevent UI freezing. */
function quiescence(chess: Chess, alpha: number, beta: number, qDepth = 0): number {
  const standPat = evaluateBoard(chess);
  const standPatPov = chess.turn() === 'w' ? standPat : -standPat;
  if (standPatPov >= beta) return beta;
  if (alpha < standPatPov) alpha = standPatPov;
  if (qDepth >= 2) return alpha; // Hard recursion cutoff to prevent browser freezing

  // Only check captures in quiescence, NOT non-capturing checks which cause combinatorial explosion
  const captures = chess.moves({ verbose: true }).filter((m) => m.captured);
  captures.sort((a, b) => (b.captured ? PIECE_VALUE[b.captured as keyof typeof PIECE_VALUE] || 0 : 0) - (a.captured ? PIECE_VALUE[a.captured as keyof typeof PIECE_VALUE] || 0 : 0));

  for (const m of captures) {
    chess.move(m);
    const score = -quiescence(chess, -beta, -alpha, qDepth + 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

/** Negamax with alpha-beta. Returns score from side-to-move POV. */
function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (chess.isCheckmate()) return -MATE - depth; // prefer faster mates
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;
  if (depth === 0) {
    return quiescence(chess, alpha, beta, 0);
  }

  const moves = chess.moves({ verbose: true });
  // Move ordering: captures first for better pruning.
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  let best = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Rank the top `multipv` root moves. `plies` controls search depth; kept small
 * (default 2) so the synchronous call stays under 300ms and never freezes the browser.
 * Quiescence search adds tactical depth (captures) on top of this.
 */
export function analyzePosition(fen: string, multipv = 3, plies = 2): RawLine[] {
  const chess = new Chess(fen);
  const rootMoves = chess.moves({ verbose: true });
  if (rootMoves.length === 0) return [];

  const searchDepth = Math.max(1, Math.min(3, plies));
  const scored: RawLine[] = rootMoves.map((m) => {
    chess.move(m);
    // Negate: child is evaluated from opponent POV.
    const childScore = -negamax(chess, searchDepth - 1, -Infinity, Infinity);
    chess.undo();

    let mate: number | null = null;
    let cp = childScore;
    if (Math.abs(childScore) > MATE - 1000) {
      const movesToMate = Math.ceil((MATE + Math.abs(childScore) - MATE) / 1) || 1;
      mate = childScore > 0 ? movesToMate : -movesToMate;
      cp = childScore > 0 ? 3000 : -3000;
    }
    return {
      uci: m.from + m.to + (m.promotion ?? ''),
      san: m.san,
      cp,
      mate,
    };
  });

  scored.sort((a, b) => b.cp - a.cp);
  return scored.slice(0, multipv);
}
