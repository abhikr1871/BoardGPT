import { findBoard } from './chesscomReader';
import { findLichessBoard } from './lichessReader';
import { findChess24Board } from './chess24Reader';

/**
 * Draws a clean green best-move arrow on the board — matches the visual style
 * of Chess.com's native orange arrow. Works on Chess.com, Lichess, Chess24.
 */
const SVG_ID = 'boardgpt-arrow-layer';

// ─── Board detection ────────────────────────────────────────────────────────

interface BoardInfo {
  el: Element;
  flipped: boolean;
}

function findAnyBoard(): BoardInfo | null {
  // Chess.com
  const ccBoard = findBoard();
  if (ccBoard) {
    return { el: ccBoard, flipped: ccBoard.classList.contains('flipped') };
  }

  // Lichess
  const lcBoard = findLichessBoard();
  if (lcBoard) {
    const flipped =
      !!lcBoard.closest('.orientation-black') ||
      !!lcBoard.closest('[class*="orientation-black"]') ||
      !!document.querySelector('cg-wrap.orientation-black');
    return { el: lcBoard, flipped };
  }

  // Chess24
  const c24Board = findChess24Board();
  if (c24Board) {
    return {
      el: c24Board,
      flipped: c24Board.classList.contains('flipped') || !!c24Board.closest('[class*="flipped"]'),
    };
  }

  return null;
}

// ─── Coordinate helpers ─────────────────────────────────────────────────────

/** Returns the pixel centre of a square within the board element. */
function squareCenter(
  file: number,   // 1 = a-file, 8 = h-file
  rank: number,   // 1 = rank 1 (bottom), 8 = rank 8 (top)
  sqSize: number,
  flipped: boolean,
) {
  // Column index from the left edge of the board
  const col = flipped ? 8 - file : file - 1;
  // Row index from the top edge of the board
  const row = flipped ? rank - 1 : 8 - rank;
  return {
    x: (col + 0.5) * sqSize,
    y: (row + 0.5) * sqSize,
  };
}

// ─── Arrow drawing ──────────────────────────────────────────────────────────

export function drawBestMoveArrow(uci: string | null): void {
  clearArrow();
  if (!uci || uci.length < 4) return;

  const board = findAnyBoard();
  if (!board) return;

  const rect = board.el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const sqSize = rect.width / 8;
  const { flipped } = board;

  const fromFile = uci.charCodeAt(0) - 96; // 'a'→1 … 'h'→8
  const fromRank = parseInt(uci[1], 10);
  const toFile   = uci.charCodeAt(2) - 96;
  const toRank   = parseInt(uci[3], 10);
  if (fromFile < 1 || fromFile > 8 || toFile < 1 || toFile > 8) return;

  const from = squareCenter(fromFile, fromRank, sqSize, flipped);
  const to   = squareCenter(toFile,   toRank,   sqSize, flipped);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = SVG_ID;
  svg.setAttribute('width',   String(rect.width));
  svg.setAttribute('height',  String(rect.height));
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  Object.assign(svg.style, {
    position:      'absolute',
    left:          '0',
    top:           '0',
    pointerEvents: 'none',
    zIndex:        '9999',
  } as CSSStyleDeclaration);

  // ── Clean arrowhead marker in pixel coordinates (userSpaceOnUse) ──
  const strokeW = sqSize * 0.16;
  const headLen = sqSize * 0.40;
  const headWid = sqSize * 0.40;

  const defs = document.createElementNS(svgNS, 'defs');
  defs.innerHTML =
    `<marker id="boardgpt-arrowhead" markerUnits="userSpaceOnUse" ` +
    `markerWidth="${headLen}" markerHeight="${headWid}" ` +
    `refX="${headLen * 0.5}" refY="${headWid * 0.5}" orient="auto">` +
    `<path d="M0,0 L${headLen},${headWid * 0.5} L0,${headWid} Z" ` +
    `fill="rgba(34,197,94,0.85)"/></marker>`;
  svg.appendChild(defs);

  // ── Shorten end so arrowhead sits centered on destination square ──
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const shrink = sqSize * 0.25;

  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x - (dx / len) * shrink));
  line.setAttribute('y2', String(to.y - (dy / len) * shrink));
  line.setAttribute('stroke',        'rgba(34,197,94,0.85)');
  line.setAttribute('stroke-width',  String(strokeW));
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('marker-end',    'url(#boardgpt-arrowhead)');
  svg.appendChild(line);

  // ── Inject into board ──
  const el = board.el as HTMLElement;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(svg);
}

export function clearArrow(): void {
  document.getElementById(SVG_ID)?.remove();
}
