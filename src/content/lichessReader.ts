import { Chess } from 'chess.js';
import { buildFen, GameTracker, type BoardSnapshot } from './chesscomReader';

export { GameTracker };

/**
 * Lichess renders its board as <cg-board> inside <cg-container> inside <cg-wrap>.
 * Pieces are <piece class="white rook"> etc. positioned absolutely with
 * transform: translate(Xpx, Ypx). The board is 8 squares × squareSize pixels.
 *
 * Alternatively, Lichess stores the FEN in a <div id="game-wrapper"> data-fen
 * attribute on some pages. We prefer that when available.
 */

const PIECE_COLOUR: Record<string, string> = {
  white: 'w', black: 'b',
};
const PIECE_TYPE: Record<string, string> = {
  pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k',
};

export function isLichess(): boolean {
  return typeof location !== 'undefined' && location.hostname.endsWith('lichess.org');
}

export function findLichessBoard(): Element | null {
  return document.querySelector('cg-board');
}

/**
 * Read placement from Lichess cg-board piece elements.
 * Each piece has classes like "white rook" and is positioned with a CSS
 * transform. The board's bounding box gives us squareSize = width/8.
 */
export function readLichessPlacement(board: Element | null = findLichessBoard()): BoardSnapshot | null {
  if (!board) return null;

  // Method 1: Fast — read data-fen from the page wrapper (analysis pages).
  const wrapper = document.querySelector('[data-fen]');
  if (wrapper) {
    const fen = wrapper.getAttribute('data-fen');
    if (fen && fen.split('/').length === 8) {
      const flipped = board.closest('cg-wrap')?.querySelector('cg-board')
        ? (board.closest('cg-container')?.classList.contains('orientation-black') ?? false)
        : false;
      // Include the full FEN when it carries a side-to-move field (authoritative turn).
      const full = fen.trim().split(/\s+/).length >= 2 ? fen.trim() : undefined;
      return { placement: fen.split(' ')[0], flipped, fen: full };
    }
  }

  // Method 2: Parse piece elements.
  const pieces = board.querySelectorAll('piece');
  if (!pieces.length) return null;

  const rect = board.getBoundingClientRect();
  if (!rect.width) return null;
  const sqSize = rect.width / 8;

  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  let found = 0;

  // Detect orientation ONCE before iterating pieces
  const flipped =
    !!board.closest('.orientation-black') ||
    !!board.closest('[class*="orientation-black"]') ||
    !!document.querySelector('cg-wrap.orientation-black');

  pieces.forEach((el) => {
    const classes = Array.from(el.classList);
    const colourKey = classes.find((c) => c === 'white' || c === 'black');
    const typeKey = classes.find((c) => PIECE_TYPE[c]);
    if (!colourKey || !typeKey) return;

    const style = (el as HTMLElement).style.transform;
    const match = /translate\(([0-9.]+)px,\s*([0-9.]+)px\)/.exec(style);
    if (!match) return;

    const px = parseFloat(match[1]);
    const py = parseFloat(match[2]);
    // Raw visual indices (0-7): fileIdx=0 is left column, rankIdx=0 is top row
    const fileIdx = Math.round(px / sqSize);
    const rankIdx = Math.round(py / sqSize);
    if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return;

    const colour = PIECE_COLOUR[colourKey];
    const ptype = PIECE_TYPE[typeKey];
    const fenChar = colour === 'w' ? ptype.toUpperCase() : ptype;

    // When NOT flipped: left=a-file, top=rank8  → grid[rankIdx][fileIdx] = correct
    // When flipped (black at bottom): left=h-file, top=rank1
    //   → must mirror both axes so a8 stays at grid[0][0]
    const gFile = flipped ? 7 - fileIdx : fileIdx;
    const gRank = flipped ? 7 - rankIdx : rankIdx;

    grid[gRank][gFile] = fenChar;
    found++;
  });

  if (found === 0) return null;

  const placement = grid
    .map((row) => {
      let out = ''; let empty = 0;
      for (const cell of row) {
        if (cell) { if (empty) out += empty; empty = 0; out += cell; }
        else empty++;
      }
      if (empty) out += empty;
      return out;
    })
    .join('/');

  return { placement, flipped };
}

/** Lichess clock turn detection — checks running clocks, data-fen attributes, and puzzle orientation. */
export function readLichessClockTurn(): 'w' | 'b' | null {
  // Method 1: running clock in live games
  const running = document.querySelector('.rclock.running, .rclock-bottom.running, .rclock-top.running');
  if (running) {
    if (running.classList.contains('rclock-bottom')) {
      const isBlack = document.querySelector('cg-board')?.closest('.orientation-black') !== null ||
        document.querySelector('[class*="orientation-black"]') !== null;
      return isBlack ? 'b' : 'w';
    }
    if (running.classList.contains('rclock-top')) {
      const isBlack = document.querySelector('[class*="orientation-black"]') !== null;
      return isBlack ? 'w' : 'b';
    }
  }

  // Method 2: read turn directly from data-fen attribute if present
  const fenEl = document.querySelector('[data-fen]');
  if (fenEl) {
    const fen = fenEl.getAttribute('data-fen');
    if (fen && typeof fen === 'string') {
      const parts = fen.trim().split(/\s+/);
      if (parts.length >= 2 && (parts[1] === 'w' || parts[1] === 'b')) {
        return parts[1] as 'w' | 'b';
      }
    }
  }

  // Method 3: whose turn indicator in analysis
  const turnIndicator = document.querySelector('.color-icon.white, .turn.white');
  if (turnIndicator) return 'w';
  const turnIndicatorB = document.querySelector('.color-icon.black, .turn.black');
  if (turnIndicatorB) return 'b';

  // Method 4: In Lichess training / puzzles, whose turn is it?
  // In puzzles, you solve for the color at the bottom of the board!
  if (typeof location !== 'undefined' && (location.pathname.includes('/training') || location.pathname.includes('/puzzle'))) {
    const isBlack = document.querySelector('cg-board')?.closest('.orientation-black') !== null ||
      document.querySelector('[class*="orientation-black"]') !== null ||
      document.querySelector('cg-wrap.orientation-black') !== null;
    return isBlack ? 'b' : 'w';
  }

  return null;
}

/** Detect game result on Lichess. */
export function readLichessGameResult(): string | null {
  const result = document.querySelector('.result-wrap .result');
  if (!result) return null;
  const text = result.textContent?.trim() ?? '';
  if (text === '1-0') return '1-0';
  if (text === '0-1') return '0-1';
  if (text === '½-½' || text === '1/2-1/2') return '1/2-1/2';
  // game-over via status
  const status = document.querySelector('.status');
  if (status) {
    const t = (status.textContent ?? '').toLowerCase();
    if (t.includes('white is victorious') || t.includes('white wins')) return '1-0';
    if (t.includes('black is victorious') || t.includes('black wins')) return '0-1';
    if (t.includes('draw') || t.includes('stalemate')) return '1/2-1/2';
  }
  return null;
}
