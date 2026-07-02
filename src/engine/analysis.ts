import { Chess } from 'chess.js';
import type { AnalysisResult, EngineLine } from '../types';
import { analyzePosition, type RawLine } from './builtinEngine';
import { analyzeWithStockfish, isStockfishAvailable } from './stockfish';
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
 * Analyse one position. Tries Stockfish first, falls back to the built-in
 * engine. Returns fully labelled lines with a white-POV eval bar value.
 */
export async function analyze(
  fen: string,
  depth = 18,
  multipv = 3,
): Promise<AnalysisResult> {
  const start = performance.now();
  const chess = new Chess(fen);
  const turn = chess.turn();

  let raw: RawLine[];
  let engine: 'stockfish' | 'builtin' = 'builtin';
  try {
    if (await isStockfishAvailable()) {
      raw = await analyzeWithStockfish(fen, multipv, depth);
      engine = 'stockfish';
    } else {
      raw = analyzePosition(fen, multipv, depthToPlies(depth));
    }
  } catch {
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

  return {
    fen,
    evaluation: whiteCp / 100,
    turn,
    gamePhase: detectPhase(fen),
    moves,
    latencyMs: Math.round(performance.now() - start),
    engine,
  };
}

// The built-in engine measures search in plies; keep it at 2 plies so the
// synchronous calculation completes in ~200ms and never freezes the browser.
// Quiescence search adds tactical depth on top of this.
function depthToPlies(_depth: number): number {
  return 2;
}
