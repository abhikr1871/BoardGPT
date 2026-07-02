import { Chess } from 'chess.js';

/**
 * Reads a live Chess.com game straight from the page DOM (no screenshots).
 *
 * Chess.com renders its board as a <wc-chess-board> web component whose pieces
 * are <div> elements carrying two class tokens we care about:
 *   - a piece code like "wp" / "bk"  (colour + type)
 *   - a square token like "square-52" (file digit 1-8, rank digit 1-8)
 * The board's visual orientation ("flipped" for Black) does NOT change those
 * square numbers, so the placement we read is always absolute.
 *
 * Turn/castling can't be read reliably from a single snapshot, so a GameTracker
 * reconstructs each move by diffing consecutive placements through chess.js.
 * That gives us correct side-to-move, SAN and a full PGN for recording — and
 * it self-heals if we join mid-game or miss a move.
 */

const BOARD_SELECTORS = ['wc-chess-board', 'chess-board', '.board', '#board-board'];
const PIECE_RE = /^[wb][pnbrqk]$/;
const SQUARE_RE = /^square-(\d)(\d)$/;

export interface BoardSnapshot {
  /** FEN piece-placement field only, e.g. "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR". */
  placement: string;
  /** true if the board is shown from Black's side (player is Black). */
  flipped: boolean;
}

export function findBoard(): Element | null {
  for (const sel of BOARD_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.querySelector('.piece, [class*="piece"]')) return el;
  }
  return null;
}

/** Read the current piece placement from the Chess.com board, or null. */
export function readPlacement(board: Element | null = findBoard()): BoardSnapshot | null {
  if (!board) return null;
  const pieces = board.querySelectorAll('.piece, [class*="piece-"]');
  if (!pieces.length) return null;

  // grid[rankIndex 0..7 = rank8..rank1][fileIndex 0..7 = a..h]
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  let found = 0;

  pieces.forEach((el) => {
    const classes = Array.from(el.classList);
    const code = classes.find((c) => PIECE_RE.test(c));
    const sqClass = classes.find((c) => SQUARE_RE.test(c));
    if (!code || !sqClass) return;
    const sq = SQUARE_RE.exec(sqClass)!;
    const file = parseInt(sq[1], 10);
    const rank = parseInt(sq[2], 10);
    if (file < 1 || file > 8 || rank < 1 || rank > 8) return;
    const colour = code[0];
    const ptype = code[1];
    const fenChar = colour === 'w' ? ptype.toUpperCase() : ptype.toLowerCase();
    grid[8 - rank][file - 1] = fenChar;
    found++;
  });

  if (found === 0) return null;

  const placement = grid
    .map((row) => {
      let out = '';
      let empty = 0;
      for (const cell of row) {
        if (cell) {
          if (empty) out += empty;
          empty = 0;
          out += cell;
        } else empty++;
      }
      if (empty) out += empty;
      return out;
    })
    .join('/');

  const flipped = board.classList.contains('flipped');
  return { placement, flipped };
}

/** Whose turn Chess.com's active clock indicates, if we can tell. */
export function readClockTurn(): 'w' | 'b' | null {
  // Method 1: active clock in live games
  const active = document.querySelector('.clock-player-turn, .clock-component.clock-player-turn, .clock.active');
  if (active) {
    if (active.className.includes('clock-black') || active.className.includes('black')) return 'b';
    if (active.className.includes('clock-white') || active.className.includes('white')) return 'w';
  }

  // Method 2: read turn from DOM FEN attributes if available
  const fenEls = document.querySelectorAll('[data-fen], [fen], [data-position], wc-chess-board');
  for (const el of fenEls) {
    const fen = el.getAttribute('data-fen') ?? el.getAttribute('fen') ?? el.getAttribute('data-position');
    if (fen && typeof fen === 'string') {
      const parts = fen.trim().split(/\s+/);
      if (parts.length >= 2 && (parts[1] === 'w' || parts[1] === 'b')) {
        return parts[1] as 'w' | 'b';
      }
    }
  }

  // Method 3: in puzzles/training, turn belongs to the player whose board is at the bottom
  if (typeof location !== 'undefined' && (location.pathname.includes('puzzle') || location.pathname.includes('training'))) {
    const board = document.querySelector('.wc-chess-board, wc-chess-board, .board, #board, .chessboard');
    if (board && board.classList.contains('flipped')) return 'b';
    return 'w';
  }

  return null;
}

/** Detect a finished game via Chess.com's result modal. */
export function readGameResult(): string | null {
  const modal = document.querySelector(
    '.game-over-modal-content, .board-modal-container-container, [class*="game-over"]',
  );
  if (!modal) return null;
  const text = (modal.textContent || '').toLowerCase();
  if (text.includes('white won') || text.includes('white is victorious')) return '1-0';
  if (text.includes('black won') || text.includes('black is victorious')) return '0-1';
  if (text.includes('draw') || text.includes('stalemate') || text.includes('drawn')) return '1/2-1/2';
  if (text.includes('won')) return '?'; // couldn't tell colour
  return null;
}

function castlingFromPlacement(chess: Chess): string {
  // Best-effort: grant rights when king + rook sit on home squares.
  const at = (sq: string) => chess.get(sq as any);
  let rights = '';
  const wk = at('e1');
  if (wk && wk.type === 'k' && wk.color === 'w') {
    const rh = at('h1');
    const ra = at('a1');
    if (rh && rh.type === 'r' && rh.color === 'w') rights += 'K';
    if (ra && ra.type === 'r' && ra.color === 'w') rights += 'Q';
  }
  const bk = at('e8');
  if (bk && bk.type === 'k' && bk.color === 'b') {
    const rh = at('h8');
    const ra = at('a8');
    if (rh && rh.type === 'r' && rh.color === 'b') rights += 'k';
    if (ra && ra.type === 'r' && ra.color === 'b') rights += 'q';
  }
  return rights || '-';
}

/** Assemble a full, engine-usable FEN from a placement + turn guess. */
export function buildFen(placement: string, turn: 'w' | 'b'): string {
  const partial = `${placement} ${turn} - - 0 1`;
  try {
    const chess = new Chess(partial);
    const castling = castlingFromPlacement(chess);
    return `${placement} ${turn} ${castling} - 0 1`;
  } catch {
    return partial;
  }
}

export interface TrackerUpdate {
  fen: string;
  turn: 'w' | 'b';
  lastMoveSan: string | null;
  pgn: string;
  moveCount: number;
  resynced: boolean;
}

/**
 * Tracks a game across board changes. Feed it each placement; it figures out
 * which legal move produced it, keeping SAN/PGN/turn in sync. If it can't map
 * a single move (missed updates, board reset), it resyncs to the placement and
 * uses the clock hint for turn.
 */
export class GameTracker {
  private chess = new Chess();
  private lastPlacement = '';

  reset() {
    this.chess = new Chess();
    this.lastPlacement = '';
  }

  currentFen(): string {
    return this.chess.fen();
  }

  /** Returns an update if the placement changed, else null. */
  update(snap: BoardSnapshot, clockTurn: 'w' | 'b' | null): TrackerUpdate | null {
    if (snap.placement === this.lastPlacement) return null;
    this.lastPlacement = snap.placement;

    // Try to find the single legal move that yields this placement.
    const move = this.findMatchingMove(snap.placement);
    if (move) {
      this.chess.move(move);
      return this.snapshot(move.san, false);
    }

    // Resync: rebuild from placement using best turn guess.
    const turn = clockTurn ?? this.guessTurnFromPlacement(snap.placement, snap.flipped);
    const fen = buildFen(snap.placement, turn);
    try {
      this.chess = new Chess(fen);
    } catch {
      // As a last resort keep the previous game object.
    }
    return this.snapshot(null, true);
  }

  private snapshot(lastMoveSan: string | null, resynced: boolean): TrackerUpdate {
    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      lastMoveSan,
      pgn: this.chess.pgn(),
      moveCount: this.chess.history().length,
      resynced,
    };
  }

  private findMatchingMove(targetPlacement: string) {
    const legal = this.chess.moves({ verbose: true });
    for (const m of legal) {
      this.chess.move(m);
      const placement = this.chess.fen().split(' ')[0];
      this.chess.undo();
      if (placement === targetPlacement) return m;
    }
    return null;
  }

  private guessTurnFromPlacement(placement: string, flipped: boolean): 'w' | 'b' {
    // When resyncing without clock or FEN hints (e.g. initial puzzle load or unrated casual game),
    // the active player is almost always the player at the bottom of the board (flipped = Black).
    return flipped ? 'b' : 'w';
  }
}
