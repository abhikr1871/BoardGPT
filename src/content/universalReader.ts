/**
 * Universal board reader (Phase 4, nice-to-have). Heuristically scans the DOM
 * of an arbitrary chess site for an 8x8 board and maps it to a FEN piece-
 * placement string. Self-contained and defensive: returns null whenever it
 * isn't confident, and never throws.
 *
 * Strategy: find a squarish container whose descendants include ~64 cells (or 8
 * rows of 8), then read each cell's piece from a background-image / <img> src /
 * data-piece attribute using a filename pattern like "wq.png" or "bn.svg".
 */

const PIECE_FILE_RE = /[/_-]?([wbWB])([kqrbnpKQRBNP])(?:[._-]|\b)/;
const PIECE_IMG_RE = /([wb])([kqrbnp])\.(png|svg|gif|webp)/i;

interface Cell {
  x: number;
  y: number;
  el: Element;
}

/** Public API: detect a generic board and return its FEN placement, or null. */
export function detectGenericBoard(): { placement: string } | null {
  try {
    const candidates = collectBoardCandidates();
    for (const cells of candidates) {
      const placement = cellsToPlacement(cells);
      if (placement) return { placement };
    }
    return null;
  } catch {
    return null;
  }
}

/** Gather plausible 8x8 cell grids from the DOM, most-specific first. */
function collectBoardCandidates(): Cell[][] {
  const results: Cell[][] = [];
  const seen = new Set<Element>();

  // Look at containers that could hold a board; prefer ones that look squarish.
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>('div,table,section,main,[class*="board"],[id*="board"]'),
  );

  for (const container of containers) {
    if (seen.has(container)) continue;
    const rect = container.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) continue;
    // Roughly square.
    const ratio = rect.width / (rect.height || 1);
    if (ratio < 0.7 || ratio > 1.4) continue;

    // Direct children forming 64 cells, or 8 rows of 8.
    const direct = Array.from(container.children) as HTMLElement[];
    if (direct.length === 64) {
      const cells = toCells(direct);
      if (cells.length === 64) {
        seen.add(container);
        results.push(cells);
        continue;
      }
    }
    if (direct.length === 8) {
      const rowCells: HTMLElement[] = [];
      let ok = true;
      for (const row of direct) {
        const kids = Array.from(row.children) as HTMLElement[];
        if (kids.length !== 8) {
          ok = false;
          break;
        }
        rowCells.push(...kids);
      }
      if (ok && rowCells.length === 64) {
        const cells = toCells(rowCells);
        if (cells.length === 64) {
          seen.add(container);
          results.push(cells);
          continue;
        }
      }
    }

    // Fallback: any descendant group of ~64 leaf cells arranged in a grid.
    const leaves = Array.from(
      container.querySelectorAll<HTMLElement>('div,td,span'),
    ).filter((el) => el.children.length <= 1);
    if (leaves.length >= 64) {
      const grid = pickGridCells(leaves, rect);
      if (grid.length === 64) {
        seen.add(container);
        results.push(grid);
      }
    }
  }

  return results;
}

/** Position + element for each candidate cell. */
function toCells(els: HTMLElement[]): Cell[] {
  const cells: Cell[] = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    cells.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, el });
  }
  return sortIntoGrid(cells);
}

/** From a large set of leaves, choose 64 that form the tightest 8x8 grid. */
function pickGridCells(els: HTMLElement[], containerRect: DOMRect): Cell[] {
  const step = containerRect.width / 8;
  const cells: Cell[] = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    // Cells should be about one-eighth of the board.
    if (r.width < step * 0.6 || r.width > step * 1.4) continue;
    if (r.height < step * 0.6 || r.height > step * 1.4) continue;
    cells.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, el });
  }
  const unique = dedupeByPosition(cells, step * 0.5);
  if (unique.length < 64) return [];
  return sortIntoGrid(unique.slice(0, 64));
}

/** Drop cells whose centres coincide (nested wrappers reporting the same box). */
function dedupeByPosition(cells: Cell[], tol: number): Cell[] {
  const out: Cell[] = [];
  for (const c of cells) {
    if (out.some((o) => Math.abs(o.x - c.x) < tol && Math.abs(o.y - c.y) < tol)) continue;
    out.push(c);
  }
  return out;
}

/** Order cells row-major from the top-left of the board (rank 8 → rank 1). */
function sortIntoGrid(cells: Cell[]): Cell[] {
  if (cells.length !== 64) return [];
  const byY = [...cells].sort((a, b) => a.y - b.y);
  const ordered: Cell[] = [];
  for (let r = 0; r < 8; r++) {
    const row = byY.slice(r * 8, r * 8 + 8).sort((a, b) => a.x - b.x);
    ordered.push(...row);
  }
  return ordered;
}

/** Read the piece (if any) sitting in a cell → FEN char or null. */
function pieceInCell(cell: Cell): string | null {
  const el = cell.el;

  // 1) explicit data attributes
  const dataPiece =
    el.getAttribute?.('data-piece') ??
    (el.querySelector?.('[data-piece]')?.getAttribute('data-piece') ?? null);
  if (dataPiece) {
    const m = PIECE_FILE_RE.exec(dataPiece);
    if (m) return toFenChar(m[1], m[2]);
  }

  // 2) an <img> child with a recognisable filename
  const img = (el.tagName === 'IMG' ? el : el.querySelector('img')) as HTMLImageElement | null;
  if (img?.src) {
    const m = PIECE_IMG_RE.exec(img.src) ?? PIECE_FILE_RE.exec(img.src);
    if (m) return toFenChar(m[1], m[2]);
    const alt = img.getAttribute('alt') ?? '';
    const am = PIECE_FILE_RE.exec(alt);
    if (am) return toFenChar(am[1], am[2]);
  }

  // 3) a CSS background-image on the cell or an inner element
  const bgTarget = (el.querySelector('*') as HTMLElement) ?? (el as HTMLElement);
  const bg = safeBackground(el as HTMLElement) || safeBackground(bgTarget);
  if (bg) {
    const m = PIECE_IMG_RE.exec(bg) ?? PIECE_FILE_RE.exec(bg);
    if (m) return toFenChar(m[1], m[2]);
  }

  // 4) class tokens like "white-queen" / "wq" on the cell or a child
  const classHost =
    (el.className ? el : (el.querySelector('[class]') as HTMLElement | null)) ?? null;
  const cls = classHost?.className;
  if (typeof cls === 'string') {
    const cm = /\b(white|black|w|b)[-_ ]?(king|queen|rook|bishop|knight|pawn|k|q|r|b|n|p)\b/i.exec(cls);
    if (cm) {
      const colour = cm[1][0].toLowerCase();
      const type = normalizeType(cm[2]);
      if (type) return toFenChar(colour, type);
    }
  }

  return null;
}

function safeBackground(el: HTMLElement | null): string | null {
  if (!el) return null;
  try {
    const bg = getComputedStyle(el).backgroundImage;
    return bg && bg !== 'none' ? bg : null;
  } catch {
    return null;
  }
}

function normalizeType(raw: string): string | null {
  const t = raw.toLowerCase();
  const map: Record<string, string> = {
    king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p',
    k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p',
  };
  return map[t] ?? null;
}

function toFenChar(colour: string, type: string): string {
  const t = type.toLowerCase();
  return colour.toLowerCase() === 'w' ? t.toUpperCase() : t;
}

/** Turn an ordered 64-cell grid into a FEN placement string, or null. */
function cellsToPlacement(cells: Cell[]): string | null {
  if (cells.length !== 64) return null;
  const grid: (string | null)[] = cells.map(pieceInCell);

  // Require a plausible position: some pieces and exactly one king per side is
  // ideal, but at minimum we want a handful of recognised pieces to be confident.
  const pieces = grid.filter(Boolean) as string[];
  if (pieces.length < 4) return null;
  const whiteKings = pieces.filter((p) => p === 'K').length;
  const blackKings = pieces.filter((p) => p === 'k').length;
  if (whiteKings > 1 || blackKings > 1) return null;

  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let out = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const cell = grid[r * 8 + f];
      if (cell) {
        if (empty) out += empty;
        empty = 0;
        out += cell;
      } else {
        empty++;
      }
    }
    if (empty) out += empty;
    rows.push(out);
  }
  return rows.join('/');
}
