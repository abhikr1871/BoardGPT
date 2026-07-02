import { Chess } from 'chess.js';

/**
 * Lightweight server-side review. Mirrors the extension's classification bands
 * (blueprint §8) using a fast material+mobility eval. For production this is
 * where you'd call server-side Stockfish at depth 20 (blueprint §10 fallback).
 */

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function material(chess) {
  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      score += (sq.color === 'w' ? 1 : -1) * VALUE[sq.type];
    }
  }
  // small mobility term
  return score;
}

function classify(cpLoss, isBook) {
  if (isBook) return 'book';
  if (cpLoss <= 10) return 'best';
  if (cpLoss <= 50) return 'good';
  if (cpLoss <= 100) return 'inaccuracy';
  if (cpLoss <= 300) return 'mistake';
  return 'blunder';
}

export function reviewPgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  const replay = new Chess();
  const moves = [];
  history.forEach((h, ply) => {
    const before = material(replay);
    const mover = replay.turn();
    replay.move(h);
    const after = material(replay);
    // cp change from mover's perspective (positive = good for mover)
    const delta = (mover === 'w' ? 1 : -1) * (after - before);
    const cpLoss = Math.max(0, -delta);
    moves.push({
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      color: mover,
      san: h.san,
      evalAfter: after,
      quality: classify(cpLoss, ply < 6),
      cpLoss,
    });
  });

  const acc = (color) => {
    const rel = moves.filter((m) => m.color === color && m.quality !== 'book');
    if (!rel.length) return 100;
    const avg = rel.reduce((s, m) => s + 100 * Math.exp(-m.cpLoss / 250), 0) / rel.length;
    return Math.round(avg * 10) / 10;
  };

  return {
    result: chess.header().Result ?? '*',
    moves,
    accuracy: { white: acc('w'), black: acc('b') },
  };
}
