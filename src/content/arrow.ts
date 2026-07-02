import { findBoard } from './chesscomReader';
import { findLichessBoard } from './lichessReader';
import { findChess24Board } from './chess24Reader';

/**
 * Multi-arrow board overlay (blueprint Phase 2). Draws any number of arrows in a
 * single SVG layer over the live board — e.g. green best move, blue alternative,
 * red dashed opponent threat. Works on Chess.com, Lichess and Chess24.
 */
const SVG_ID = 'boardgpt-arrow-layer';

export interface ArrowSpec {
  uci: string;
  color: string; // rgb/rgba/hex
  /** stroke width as a fraction of one square (default 0.16). */
  widthFactor?: number;
  /** dashed line (opponent threat). */
  dashed?: boolean;
  /** 0..1 (default 0.85). */
  opacity?: number;
}

// ─── Board detection ────────────────────────────────────────────────────────
interface BoardInfo {
  el: Element;
  flipped: boolean;
}

function findAnyBoard(): BoardInfo | null {
  const ccBoard = findBoard();
  if (ccBoard) return { el: ccBoard, flipped: ccBoard.classList.contains('flipped') };

  const lcBoard = findLichessBoard();
  if (lcBoard) {
    const flipped =
      !!lcBoard.closest('.orientation-black') ||
      !!lcBoard.closest('[class*="orientation-black"]') ||
      !!document.querySelector('cg-wrap.orientation-black');
    return { el: lcBoard, flipped };
  }

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
function squareCenter(file: number, rank: number, sqSize: number, flipped: boolean) {
  const col = flipped ? 8 - file : file - 1;
  const row = flipped ? rank - 1 : 8 - rank;
  return { x: (col + 0.5) * sqSize, y: (row + 0.5) * sqSize };
}

const svgNS = 'http://www.w3.org/2000/svg';

// ─── Drawing ──────────────────────────────────────────────────────────────────
/** Draw a set of arrows, replacing any currently shown. */
export function drawArrows(specs: ArrowSpec[]): void {
  clearArrows();
  const valid = specs.filter((s) => s.uci && s.uci.length >= 4);
  if (!valid.length) return;

  const board = findAnyBoard();
  if (!board) return;
  const rect = board.el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const sqSize = rect.width / 8;
  const { flipped } = board;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = SVG_ID;
  svg.setAttribute('width', String(rect.width));
  svg.setAttribute('height', String(rect.height));
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  Object.assign(svg.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    pointerEvents: 'none',
    zIndex: '9999',
  } as CSSStyleDeclaration);

  const defs = document.createElementNS(svgNS, 'defs');
  svg.appendChild(defs);

  valid.forEach((spec, i) => {
    const fromFile = spec.uci.charCodeAt(0) - 96;
    const fromRank = parseInt(spec.uci[1], 10);
    const toFile = spec.uci.charCodeAt(2) - 96;
    const toRank = parseInt(spec.uci[3], 10);
    if (fromFile < 1 || fromFile > 8 || toFile < 1 || toFile > 8) return;

    const from = squareCenter(fromFile, fromRank, sqSize, flipped);
    const to = squareCenter(toFile, toRank, sqSize, flipped);

    const opacity = spec.opacity ?? 0.85;
    const strokeW = sqSize * (spec.widthFactor ?? 0.16);
    const headLen = sqSize * 0.4;
    const headWid = sqSize * 0.4;
    const markerId = `boardgpt-head-${i}`;

    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', String(headLen));
    marker.setAttribute('markerHeight', String(headWid));
    marker.setAttribute('refX', String(headLen * 0.5));
    marker.setAttribute('refY', String(headWid * 0.5));
    marker.setAttribute('orient', 'auto');
    const head = document.createElementNS(svgNS, 'path');
    head.setAttribute('d', `M0,0 L${headLen},${headWid * 0.5} L0,${headWid} Z`);
    head.setAttribute('fill', spec.color);
    head.setAttribute('opacity', String(opacity));
    marker.appendChild(head);
    defs.appendChild(marker);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const shrink = sqSize * 0.25;

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x - (dx / len) * shrink));
    line.setAttribute('y2', String(to.y - (dy / len) * shrink));
    line.setAttribute('stroke', spec.color);
    line.setAttribute('stroke-opacity', String(opacity));
    line.setAttribute('stroke-width', String(strokeW));
    line.setAttribute('stroke-linecap', 'round');
    if (spec.dashed) line.setAttribute('stroke-dasharray', `${sqSize * 0.18} ${sqSize * 0.14}`);
    line.setAttribute('marker-end', `url(#${markerId})`);
    svg.appendChild(line);
  });

  const el = board.el as HTMLElement;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(svg);
}

export function clearArrows(): void {
  document.getElementById(SVG_ID)?.remove();
}

// ── Back-compat single-arrow helpers (used by the opening recommender) ──
export function drawBestMoveArrow(uci: string | null): void {
  if (!uci) return clearArrows();
  drawArrows([{ uci, color: 'rgba(34,197,94,0.9)' }]);
}

export const clearArrow = clearArrows;
