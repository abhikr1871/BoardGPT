import { Chess } from 'chess.js';
import type { AnnotatedMove, GameReview, MoveQuality } from '../types';
import { analyzePosition } from './builtinEngine';

/**
 * Post-game analysis (blueprint §8). Parses a PGN, re-analyses every half-move,
 * classifies it by centipawn loss, computes per-side accuracy, flags critical
 * moments, detects the opening and writes a short coaching summary.
 *
 * Uses the built-in engine at a shallow depth for speed. When Stockfish is
 * wired in, swap analyzePosition for analyzeWithStockfish at depth 20.
 */

const PLIES = 2;

// Minimal opening book keyed by the first few SAN moves.
const OPENINGS: { moves: string[]; name: string }[] = [
  { moves: ['e4', 'c5'], name: 'Sicilian Defence' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], name: 'Ruy López' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], name: 'Italian Game' },
  { moves: ['e4', 'e6'], name: 'French Defence' },
  { moves: ['e4', 'c6'], name: 'Caro-Kann Defence' },
  { moves: ['d4', 'd5', 'c4'], name: "Queen's Gambit" },
  { moves: ['d4', 'Nf6', 'c4', 'g6'], name: "King's Indian Defence" },
  { moves: ['d4', 'Nf6', 'c4', 'e6'], name: 'Nimzo/Queen’s Indian complex' },
  { moves: ['c4'], name: 'English Opening' },
  { moves: ['Nf3', 'd5'], name: 'Réti Opening' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6'], name: 'Open Game' },
];

function detectOpening(sans: string[]): string | undefined {
  let best: string | undefined;
  let bestLen = 0;
  for (const o of OPENINGS) {
    if (o.moves.length > sans.length) continue;
    const matches = o.moves.every((m, i) => sans[i] === m);
    if (matches && o.moves.length > bestLen) {
      best = o.name;
      bestLen = o.moves.length;
    }
  }
  return best;
}

function classify(cpLoss: number, ply: number, isBookMove: boolean, wasSacrifice: boolean): MoveQuality {
  if (isBookMove) return 'book';
  if (cpLoss <= 0 && wasSacrifice) return 'brilliant';
  if (cpLoss <= 10) return 'best';
  if (cpLoss <= 50) return 'good';
  if (cpLoss <= 100) return 'inaccuracy';
  if (cpLoss <= 300) return 'mistake';
  return 'blunder';
}

/** Per-move accuracy from centipawn loss (logistic-style, capped at 100). */
function moveAccuracy(cpLoss: number): number {
  return Math.max(0, Math.min(100, 100 * Math.exp(-cpLoss / 250)));
}

export function reviewGame(pgn: string): GameReview {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const sans = history.map((h) => h.san);
  const opening = detectOpening(sans);

  const replay = new Chess();
  const moves: AnnotatedMove[] = [];

  history.forEach((h, ply) => {
    const fenBefore = replay.fen();
    const color = replay.turn();

    // Best line for the side to move (player POV cp).
    const bestLines = analyzePosition(fenBefore, 1, PLIES);
    const bestScore = bestLines.length ? bestLines[0].cp : 0;
    const bestSan = bestLines.length ? bestLines[0].san : h.san;

    // Play the actual move, then score the resulting position (player POV).
    replay.move(h);
    const fenAfter = replay.fen();
    const oppLines = analyzePosition(fenAfter, 1, PLIES);
    const playedScore = oppLines.length ? -oppLines[0].cp : 0;

    const cpLoss = Math.max(0, bestScore - playedScore);
    const isBook = ply < (opening ? 6 : 2);
    const wasSacrifice = !!h.captured && playedScore >= bestScore - 10 && cpLoss <= 10 && h.piece !== 'p';

    const quality = classify(cpLoss, ply, isBook, wasSacrifice);

    // Store evals in white POV centipawns for the accuracy graph.
    const evalBeforeWhite = color === 'w' ? bestScore : -bestScore;
    const evalAfterWhite = color === 'w' ? playedScore : -playedScore;

    moves.push({
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      color,
      san: h.san,
      fenBefore,
      fenAfter,
      evalBefore: evalBeforeWhite,
      evalAfter: evalAfterWhite,
      bestSan,
      quality,
      cpLoss,
      comment: commentFor(quality, h.san, bestSan, cpLoss),
    });
  });

  const accuracy = computeAccuracy(moves);
  const criticalMoments = pickCriticalMoments(moves);
  const coachingSummary = writeCoachingSummary(moves, accuracy, opening);

  return {
    pgn,
    opening,
    result: chess.header().Result ?? '*',
    moves,
    accuracy,
    criticalMoments,
    coachingSummary,
  };
}

function commentFor(q: MoveQuality, san: string, best: string, cpLoss: number): string {
  switch (q) {
    case 'brilliant':
      return `${san} is a brilliant idea — a sacrifice that keeps the advantage.`;
    case 'best':
      return `${san} is the top engine choice.`;
    case 'good':
      return `${san} is solid; nearly as good as ${best}.`;
    case 'inaccuracy':
      return `${san} is slightly inaccurate — ${best} was a touch better (−${cpLoss}cp).`;
    case 'mistake':
      return `${san} is a mistake; ${best} was clearly stronger (−${cpLoss}cp).`;
    case 'blunder':
      return `${san} is a blunder that swings the game — ${best} was required (−${cpLoss}cp).`;
    case 'book':
      return `${san} is a known opening move.`;
  }
}

function computeAccuracy(moves: AnnotatedMove[]): { white: number; black: number } {
  const acc = (color: 'w' | 'b') => {
    const rel = moves.filter((m) => m.color === color && m.quality !== 'book');
    if (!rel.length) return 100;
    const avg = rel.reduce((s, m) => s + moveAccuracy(m.cpLoss), 0) / rel.length;
    return Math.round(avg * 10) / 10;
  };
  return { white: acc('w'), black: acc('b') };
}

function pickCriticalMoments(moves: AnnotatedMove[]): number[] {
  return [...moves]
    .sort((a, b) => b.cpLoss - a.cpLoss)
    .slice(0, 3)
    .filter((m) => m.cpLoss >= 100)
    .map((m) => m.ply)
    .sort((a, b) => a - b);
}

function writeCoachingSummary(
  moves: AnnotatedMove[],
  accuracy: { white: number; black: number },
  opening?: string,
): string {
  const blunders = moves.filter((m) => m.quality === 'blunder');
  const worst = [...moves].sort((a, b) => b.cpLoss - a.cpLoss)[0];
  const lines: string[] = [];

  if (opening) lines.push(`The game opened with the ${opening}.`);
  lines.push(
    `White played with ${accuracy.white}% accuracy and Black with ${accuracy.black}%.`,
  );

  if (worst && worst.cpLoss >= 100) {
    const side = worst.color === 'w' ? 'White' : 'Black';
    lines.push(
      `The turning point was move ${worst.moveNumber} (${worst.san}): ${side} should have played ${worst.bestSan}, losing about ${worst.cpLoss} centipawns.`,
    );
  }

  const takeaways: string[] = [];
  if (blunders.length) takeaways.push(`avoid the ${blunders.length} blunder(s) by double-checking forcing replies`);
  const inacc = moves.filter((m) => m.quality === 'inaccuracy' || m.quality === 'mistake').length;
  if (inacc) takeaways.push(`tighten up ${inacc} inaccurate/mistaken move(s) in the middlegame`);
  takeaways.push('keep pieces active and the king safe');
  lines.push(`Key takeaways: ${takeaways.join('; ')}.`);

  return lines.join(' ');
}
