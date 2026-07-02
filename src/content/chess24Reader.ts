import { type BoardSnapshot } from './chesscomReader';

/**
 * Chess24 board reader.
 *
 * Chess24 uses a React-rendered board where pieces are positioned inside a
 * board container. The board element typically has class "chess24-board" or
 * similar. Pieces have data attributes or class names indicating their type
 * and position.
 *
 * Chess24 also exposes the game PGN/FEN in the page's Redux store or in
 * meta tags / data attributes on certain elements. We try multiple strategies:
 *
 * Strategy 1: Read data-fen from a wrapper element.
 * Strategy 2: Read from window.__REDUX_STATE__ or similar global.
 * Strategy 3: Parse piece DOM elements similar to Chess.com approach.
 */

export function isChess24(): boolean {
  return typeof location !== 'undefined' && location.hostname.includes('chess24.com');
}

export function findChess24Board(): Element | null {
  // Chess24 board selectors (may vary by version)
  const selectors = [
    '.chess24-board',
    '.chessboard',
    '[class*="ChessBoard"]',
    '[class*="chessboard"]',
    '#chessboard',
    '.board-component',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

const C24_PIECE_MAP: Record<string, string> = {
  'wp': 'P', 'wr': 'R', 'wn': 'N', 'wb': 'B', 'wq': 'Q', 'wk': 'K',
  'bp': 'p', 'br': 'r', 'bn': 'n', 'bb': 'b', 'bq': 'q', 'bk': 'k',
};

export function readChess24Placement(board: Element | null = findChess24Board()): BoardSnapshot | null {
  if (!board) return null;

  // Strategy 1: data-fen on a wrapper
  const fenEl = document.querySelector('[data-fen], [data-position]');
  if (fenEl) {
    const fen = fenEl.getAttribute('data-fen') ?? fenEl.getAttribute('data-position');
    if (fen && fen.includes('/')) {
      const full = fen.trim().split(/\s+/).length >= 2 ? fen.trim() : undefined;
      return { placement: fen.split(' ')[0], flipped: false, fen: full };
    }
  }

  // Strategy 2: window globals (React/Redux store)
  try {
    const win = window as any;
    const fen =
      win.__chess24_fen ??
      win.__INITIAL_STATE__?.game?.fen ??
      win.__redux_state__?.game?.currentFen;
    if (fen && typeof fen === 'string' && fen.includes('/')) {
      const full = fen.trim().split(/\s+/).length >= 2 ? fen.trim() : undefined;
      return { placement: fen.split(' ')[0], flipped: false, fen: full };
    }
  } catch {
    // ignore
  }

  // Strategy 3: Parse piece elements by square class or data-square
  const pieces = board.querySelectorAll('[class*="piece"], [data-piece]');
  if (!pieces.length) return null;

  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  let found = 0;

  pieces.forEach((el) => {
    // Try data-square="e2" style
    const sq = el.getAttribute('data-square');
    const piece = el.getAttribute('data-piece') ?? '';

    if (sq && sq.length === 2) {
      const file = sq.charCodeAt(0) - 97; // a=0
      const rank = 8 - parseInt(sq[1], 10); // rank8=0
      if (file >= 0 && file <= 7 && rank >= 0 && rank <= 7) {
        const fenChar = C24_PIECE_MAP[piece] ?? null;
        if (fenChar) { grid[rank][file] = fenChar; found++; }
      }
      return;
    }

    // Try class-based approach: piece-wp-e2 etc.
    const cls = Array.from(el.classList).join(' ');
    const m = /piece-([wb][pnbrqk])-([a-h][1-8])/.exec(cls);
    if (m) {
      const fenChar = C24_PIECE_MAP[m[1]];
      const file = m[2].charCodeAt(0) - 97;
      const rank = 8 - parseInt(m[2][1], 10);
      if (fenChar && file >= 0 && file <= 7 && rank >= 0 && rank <= 7) {
        grid[rank][file] = fenChar;
        found++;
      }
    }
  });

  if (found < 2) return null;

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

  return { placement, flipped: false };
}

export function readChess24ClockTurn(): 'w' | 'b' | null {
  // Method 1: active clock
  const active = document.querySelector('.clock.active, [class*="Clock"][class*="active"]');
  if (active) {
    if (active.className.includes('white') || active.className.includes('bottom')) return 'w';
    if (active.className.includes('black') || active.className.includes('top')) return 'b';
  }

  // Method 2: check FEN attributes in DOM
  const fenEl = document.querySelector('[data-fen], [data-position]');
  if (fenEl) {
    const fen = fenEl.getAttribute('data-fen') ?? fenEl.getAttribute('data-position');
    if (fen && typeof fen === 'string') {
      const parts = fen.trim().split(/\s+/);
      if (parts.length >= 2 && (parts[1] === 'w' || parts[1] === 'b')) {
        return parts[1] as 'w' | 'b';
      }
    }
  }

  // Method 3: in puzzles/training, turn belongs to player at the bottom of the board
  if (typeof location !== 'undefined' && (location.pathname.includes('puzzle') || location.pathname.includes('training'))) {
    const board = document.querySelector('.chess24-board, .chessboard, [class*="ChessBoard"]');
    if (board && (board.classList.contains('flipped') || board.closest('[class*="flipped"]'))) return 'b';
    return 'w';
  }

  return null;
}

export function readChess24GameResult(): string | null {
  const result = document.querySelector('[class*="result"], .game-result');
  if (!result) return null;
  const t = (result.textContent ?? '').trim();
  if (t === '1-0') return '1-0';
  if (t === '0-1') return '0-1';
  if (t.includes('½') || t === '1/2-1/2') return '1/2-1/2';
  return null;
}
