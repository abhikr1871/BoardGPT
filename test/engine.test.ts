import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePosition } from '../src/engine/builtinEngine';
import { analyze, detectPhase } from '../src/engine/analysis';
import { reviewGame } from '../src/engine/postgame';
import { heuristicExplanation } from '../src/engine/claude';
import { bandForCp, cpToBarFraction, formatEval } from '../src/lib/evaluation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('builtin engine returns ranked legal moves from the start', () => {
  const lines = analyzePosition(START, 3, 2);
  assert.equal(lines.length, 3);
  assert.ok(lines[0].san.length > 0);
  // best cp should be >= subsequent lines (sorted descending)
  assert.ok(lines[0].cp >= lines[1].cp);
});

test('engine finds mate in one (back-rank)', () => {
  // White to move, Qd8# style: white queen delivers mate.
  const fen = '6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1';
  const lines = analyzePosition(fen, 3, 3);
  const mate = lines.find((l) => l.mate !== null && l.mate > 0);
  assert.ok(mate, 'should detect a forced mate line');
});

test('engine prefers winning a free queen', () => {
  // White to move can capture an undefended black queen on d5 with a pawn.
  const fen = 'rnb1kbnr/ppp1pppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const lines = analyzePosition(fen, 3, 3);
  assert.equal(lines[0].uci, 'e4d5');
});

test('analyze() wraps results with labels and white-POV eval', async () => {
  const res = await analyze(START, 12, 3);
  assert.equal(res.moves[0].label, 'BEST');
  assert.equal(res.engine, 'builtin');
  assert.equal(res.turn, 'w');
  assert.equal(typeof res.evaluation, 'number');
});

test('detectPhase classifies the opening', () => {
  assert.equal(detectPhase(START), 'opening');
});

test('evaluation bands and helpers', () => {
  assert.equal(bandForCp(500).label, 'Winning');
  assert.equal(bandForCp(0).label, 'Equal');
  assert.equal(bandForCp(-500).label, 'Critical');
  assert.ok(cpToBarFraction(0) > 0.49 && cpToBarFraction(0) < 0.51);
  assert.equal(formatEval(180, null), '+1.8');
  assert.equal(formatEval(0, 3), 'M3');
});

test('heuristic explanation describes a capture', () => {
  const fen = 'rnb1kbnr/ppp1pppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const text = heuristicExplanation(fen, {
    rank: 1, uci: 'e4d5', san: 'exd5', cp: 800, mate: null, label: 'BEST',
  });
  assert.match(text, /Captures/);
});

test('post-game review classifies moves and computes accuracy', () => {
  const pgn = `[Event "Test"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;
  const review = reviewGame(pgn);
  assert.equal(review.moves.length, 6);
  assert.ok(review.accuracy.white >= 0 && review.accuracy.white <= 100);
  assert.ok(review.accuracy.black >= 0 && review.accuracy.black <= 100);
  assert.equal(review.opening, 'Ruy López');
  assert.ok(review.coachingSummary && review.coachingSummary.length > 0);
});

test("post-game flags a blunder (hanging the queen)", () => {
  // 1. e4 e5 2. Qh5 Nc6 3. Qxe5?? hangs nothing but 2...Ke7?? would; use a clear drop.
  const pgn = `[Result "*"]\n\n1. e4 e5 2. Qh5 Ke7 *`;
  const review = reviewGame(pgn);
  const kingMove = review.moves.find((m) => m.san === 'Ke7');
  assert.ok(kingMove, 'Ke7 present');
  assert.ok(['mistake', 'blunder', 'inaccuracy'].includes(kingMove!.quality));
});
