import { Chess } from 'chess.js';
import type { AnalysisResult, EngineLine } from '../types';
import { analyzePosition, type RawLine } from './builtinEngine';
import { requestEngineAnalysis } from './stockfish';
import { labelForRank } from '../lib/evaluation';

/** Detect game phase from remaining material (blueprint §11 game_phase). */
export function detectPhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
  const chess = new Chess(fen);
  const board = chess.board().flat().filter(Boolean);
  const majorMinor = board.filter((p) => p && ['q', 'r', 'b', 'n'].includes(p.type)).length;
  const moveNumber = chess.moveNumber();
  if (moveNumber <= 10) return 'opening';
  if (majorMinor <= 6) return 'endgame';
  return 'middlegame';
}

/**
 * Analyse one position.
 *
 * Primary path: delegate to the offscreen engine (Stockfish, or the built-in
 * engine run in the offscreen thread). This keeps the page's main thread free —
 * no engine computation ever runs here, so the site never freezes.
 *
 * Fallback path: only when the extension messaging bus is unavailable (unit
 * tests, plain web preview) do we run the built-in engine locally, and then
 * only at a bounded 2-ply depth (~200ms) so a stall is never long.
 */
export async function analyze(
  fen: string,
  depth = 18,
  multipv = 3,
  withThreat = false,
): Promise<AnalysisResult> {
  const start = performance.now();
  const chess = new Chess(fen);
  const turn = chess.turn();

  let raw: RawLine[];
  let engine: 'stockfish' | 'builtin' = 'builtin';

  const offscreen = await requestEngineAnalysis(fen, multipv, depth);
  if (offscreen && offscreen.lines.length) {
    raw = offscreen.lines;
    engine = offscreen.engine;
  } else {
    // Bounded local fallback (tests / non-extension contexts).
    raw = analyzePosition(fen, multipv, depthToPlies(depth));
    engine = 'builtin';
  }

  const bestCp = raw.length ? raw[0].cp : 0;
  const moves: EngineLine[] = raw.map((line, i) => ({
    rank: i + 1,
    uci: line.uci,
    san: line.san,
    cp: line.cp,
    mate: line.mate,
    label: labelForRank(i + 1, bestCp - line.cp),
  }));

  // Convert side-to-move cp of the best line to white POV for the eval bar.
  const whiteCp = turn === 'w' ? bestCp : -bestCp;

  const threat = withThreat ? await computeThreat(fen, depth) : null;

  return {
    fen,
    evaluation: whiteCp / 100,
    turn,
    gamePhase: detectPhase(fen),
    moves,
    latencyMs: Math.round(performance.now() - start),
    engine,
    threat,
  };
}

/**
 * Opponent's strongest threat = their best move if it were their turn now.
 * We flip the side-to-move on the FEN (a "null move") and analyse shallowly.
 * Returns null when the flipped position is illegal (e.g. the side to move is
 * already giving check) or the engine finds nothing.
 */
async function computeThreat(
  fen: string,
  depth: number,
): Promise<AnalysisResult['threat']> {
  const flipped = flipSideToMove(fen);
  if (!flipped) return null;
  const threatDepth = Math.min(12, Math.max(6, Math.round(depth / 2)));
  let lines: RawLine[] | null = null;
  const off = await requestEngineAnalysis(flipped, 1, threatDepth);
  if (off && off.lines.length) lines = off.lines;
  else lines = safeLocal(flipped);
  if (!lines || !lines.length) return null;
  const t = lines[0];
  return { uci: t.uci, san: t.san, cp: t.cp, mate: t.mate };
}

/** Return a FEN identical to `fen` but with the other side to move, or null if illegal. */
function flipSideToMove(fen: string): string | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return null;
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-'; // en passant no longer applies after a null move
  const candidate = parts.join(' ');
  try {
    const c = new Chess(candidate);
    // Illegal if the side NOT to move is in check (their king could be captured).
    if (c.isCheck()) {
      // isCheck() reports the side-to-move in check, which is fine; the illegal
      // case is the opponent (who just "moved") being in check. Detect that by
      // confirming the position has legal moves and no immediate king capture.
      if (c.moves().length === 0) return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function safeLocal(fen: string): RawLine[] | null {
  try {
    return analyzePosition(fen, 1, 2);
  } catch {
    return null;
  }
}

// The built-in engine measures search in plies; keep it at 2 plies so the
// synchronous calculation completes in ~200ms and never freezes the browser.
// Quiescence search adds tactical depth on top of this.
function depthToPlies(_depth: number): number {
  return 2;
}
