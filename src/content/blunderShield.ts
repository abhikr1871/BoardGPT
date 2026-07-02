import { Chess } from 'chess.js';
import { findBoard, readFenFromDom } from './chesscomReader';
import { requestEngineAnalysis } from '../engine/stockfish';

/**
 * Blunder Shield (Phase 4). Watches the player drag pieces on the Chess.com
 * board and, when a move looks like it drops the evaluation hard, flashes the
 * destination square: an orange pulse for a ≥200cp drop, a red pulse + shake
 * for a ≥500cp drop.
 *
 * Everything here is best-effort and defensive: if the board, FEN or engine is
 * unavailable, or anything throws, it silently no-ops. It never blocks the
 * user's move — feedback is purely visual and asynchronous.
 */

const STYLE_ID = 'boardgpt-blunder-shield-style';
const OVERLAY_ID = 'boardgpt-blunder-flash';
/** Evaluation drop (centipawns) thresholds for the two warning tiers. */
const WARN_CP = 200;
const DANGER_CP = 500;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes boardgpt-bs-pulse {
  0% { transform: scale(0.9); opacity: 0.15; }
  50% { transform: scale(1); opacity: 0.9; }
  100% { transform: scale(0.9); opacity: 0; }
}
@keyframes boardgpt-bs-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
.boardgpt-bs-flash {
  position: absolute;
  pointer-events: none;
  z-index: 9998;
  border-radius: 6px;
  box-sizing: border-box;
}
.boardgpt-bs-warn {
  background: rgba(251,146,60,0.35);
  border: 2px solid rgba(251,146,60,0.9);
  animation: boardgpt-bs-pulse 0.9s ease-out 2;
}
.boardgpt-bs-danger {
  background: rgba(239,68,68,0.4);
  border: 2px solid rgba(239,68,68,0.95);
  animation: boardgpt-bs-pulse 0.7s ease-out 3, boardgpt-bs-shake 0.5s ease-in-out 1;
}
`;
  document.head.appendChild(style);
}

/** File/rank (1..8) for the square under a client point, relative to the board. */
function squareAtPoint(
  board: Element,
  clientX: number,
  clientY: number,
): { file: number; rank: number; rect: DOMRect } | null {
  const rect = board.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const flipped = board.classList.contains('flipped');
  const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
  const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  // Board square numbers are absolute (a1 = file1/rank1) regardless of flip.
  const file = flipped ? 8 - col : col + 1;
  const rank = flipped ? row + 1 : 8 - row;
  return { file, rank, rect };
}

function squareToCoord(file: number, rank: number): string {
  return String.fromCharCode(96 + file) + String(rank);
}

/** Flash the destination square on the board with the given warning tier. */
function flashSquare(board: Element, file: number, rank: number, tier: 'warn' | 'danger'): void {
  try {
    ensureStyle();
    const rect = board.getBoundingClientRect();
    const sq = rect.width / 8;
    const flipped = board.classList.contains('flipped');
    const col = flipped ? 8 - file : file - 1;
    const row = flipped ? rank - 1 : 8 - rank;

    const el = document.getElementById(OVERLAY_ID);
    el?.remove();

    const flash = document.createElement('div');
    flash.id = OVERLAY_ID;
    flash.className = `boardgpt-bs-flash boardgpt-bs-${tier}`;
    Object.assign(flash.style, {
      left: `${col * sq}px`,
      top: `${row * sq}px`,
      width: `${sq}px`,
      height: `${sq}px`,
    } as CSSStyleDeclaration);

    const host = board as HTMLElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(flash);
    setTimeout(() => flash.remove(), 2200);
  } catch {
    // never let a visual glitch break gameplay
  }
}

/** Best-effort: white-POV centipawns for the side to move in `fen`. */
async function evalCpWhitePov(fen: string): Promise<number | null> {
  const res = await requestEngineAnalysis(fen, 1, 12);
  const best = res?.lines?.[0];
  if (!best) return null;
  // Engine cp is from side-to-move POV; normalise to White POV.
  const turn = fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
  const stmCp = best.mate !== null ? (best.mate > 0 ? 100000 : -100000) : best.cp;
  return turn === 'w' ? stmCp : -stmCp;
}

/**
 * Attach the shield. Returns a cleanup function that removes listeners and any
 * injected style. `getEnabled` is polled live so the setting can toggle without
 * re-initialising.
 */
export function initBlunderShield(getEnabled: () => boolean): () => void {
  let board: Element | null = null;
  let dragFrom: { file: number; rank: number } | null = null;

  const onPointerDown = (e: Event) => {
    try {
      if (!getEnabled()) return;
      const pe = e as PointerEvent;
      const b = findBoard();
      if (!b) return;
      board = b;
      const sq = squareAtPoint(b, pe.clientX, pe.clientY);
      dragFrom = sq ? { file: sq.file, rank: sq.rank } : null;
    } catch {
      dragFrom = null;
    }
  };

  const onPointerUp = (e: Event) => {
    const from = dragFrom;
    dragFrom = null;
    try {
      if (!getEnabled() || !from || !board) return;
      const pe = e as PointerEvent;
      const dest = squareAtPoint(board, pe.clientX, pe.clientY);
      if (!dest) return;
      if (dest.file === from.file && dest.rank === from.rank) return; // click, not a move

      const boardEl = board;
      const fen = readFenFromDom(boardEl);
      if (!fen) return;

      const fromSq = squareToCoord(from.file, from.rank);
      const toSq = squareToCoord(dest.file, dest.rank);

      // Evaluate before/after asynchronously; never block the move.
      void (async () => {
        try {
          const chess = new Chess(fen);
          const played = chess.move({ from: fromSq, to: toSq, promotion: 'q' });
          if (!played) return;

          const beforeWhite = await evalCpWhitePov(fen);
          const afterWhite = await evalCpWhitePov(chess.fen());
          if (beforeWhite === null || afterWhite === null) return;

          // The mover's loss is measured from their own POV.
          const moverWasWhite = played.color === 'w';
          const beforeMover = moverWasWhite ? beforeWhite : -beforeWhite;
          const afterMover = moverWasWhite ? afterWhite : -afterWhite;
          const drop = beforeMover - afterMover;

          if (drop >= DANGER_CP) flashSquare(boardEl, dest.file, dest.rank, 'danger');
          else if (drop >= WARN_CP) flashSquare(boardEl, dest.file, dest.rank, 'warn');
        } catch {
          // swallow — shield must never throw
        }
      })();
    } catch {
      // swallow
    }
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  };
}
