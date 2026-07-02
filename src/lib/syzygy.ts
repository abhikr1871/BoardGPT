import { loadSettings } from './storage';

/**
 * Syzygy endgame tablebase client.
 *
 * The tablebase gives perfect play for positions with a small number of pieces
 * (Syzygy covers up to 7). We use it to power the Masterclass endgame trainer:
 * after the learner moves, we probe the resulting position and let the machine
 * reply with the mathematically best defence/attack.
 *
 * ── Pointing this at a custom API ────────────────────────────────────────────
 * The endpoint is CONFIGURABLE. By default we hit the public Lichess tablebase
 * (`https://tablebase.lichess.ovh`) so it works out of the box. To use your own
 * server, set the Backend/Syzygy URL in Settings (`settings.syzygyApiUrl`).
 *
 * Whatever you point it at MUST speak the Lichess-tablebase JSON dialect:
 *   GET  {base}/standard?fen={urlEncodedFen}
 *   200  {
 *          "category": "win" | "loss" | "draw" | "cursed-win" | "blessed-loss" | "unknown",
 *          "dtz": number | null,   // distance-to-zeroing (50-move-rule metric)
 *          "dtm": number | null,   // distance-to-mate (may be null if unknown)
 *          "moves": [
 *            { "uci": "e2e7", "san": "Qe7+", "category": "loss",
 *              "dtz": -14, "dtm": -16, "zeroing": false, ... }
 *          ]
 *        }
 *
 * The `moves` array is returned best-first for the side to move, so the first
 * entry is the move to play. Per-move `category`/`dtz`/`dtm` are reported from
 * the perspective of the player who is to move *after* that move (the opponent),
 * which is why a winning move typically shows category "loss".
 */

/** The category of a position/move as reported by the tablebase. */
export type TablebaseCategory =
  | 'win'
  | 'loss'
  | 'draw'
  | 'cursed-win'
  | 'blessed-loss'
  | 'unknown';

/** A single ranked candidate move from the tablebase (best-first ordering). */
export interface TablebaseMove {
  /** UCI notation, e.g. "e2e7" (with promotion suffix like "e7e8q" when relevant). */
  uci: string;
  /** Standard algebraic notation, e.g. "Qe7+". */
  san: string;
  /**
   * Outcome category. Note: this is from the perspective of the side to move
   * *after* this move is played (i.e. the opponent), matching the Lichess shape.
   */
  category: string;
  /** Distance-to-zeroing (50-move-rule metric), or null when unavailable. */
  dtz: number | null;
  /** Distance-to-mate in plies, or null when unavailable/unknown. */
  dtm: number | null;
  /** True when the move resets the 50-move counter (capture or pawn move). */
  zeroing?: boolean;
}

/** Result of probing one position. */
export interface TablebaseResult {
  /** Outcome for the side to move: win | loss | draw | cursed-win | blessed-loss | unknown. */
  category: string;
  /** Distance-to-zeroing for the side to move, or null. */
  dtz: number | null;
  /** Distance-to-mate for the side to move, or null. */
  dtm: number | null;
  /** Candidate moves, sorted best-first for the side to move (as returned by the API). */
  moves: TablebaseMove[];
}

/** Number of piece characters in the FEN board field (used to gate ≤7-piece probes). */
function pieceCount(fen: string): number {
  const board = fen.trim().split(/\s+/)[0] ?? '';
  let count = 0;
  for (const ch of board) {
    if (/[pnbrqkPNBRQK]/.test(ch)) count += 1;
  }
  return count;
}

/** Coerce an unknown JSON value into `number | null` without throwing. */
function asNumOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Probe the configured Syzygy tablebase for the given FEN.
 *
 * Loads `settings.syzygyApiUrl` and performs
 * `GET {base}/standard?fen={encoded}`. Only meaningful for positions with ≤7
 * pieces (Syzygy's coverage limit); positions with more pieces are rejected
 * locally without a network round-trip.
 *
 * Never throws — returns `null` on too-many-pieces, network failure, non-OK
 * response, or malformed JSON, so callers can gracefully fall back to free play.
 */
export async function probeTablebase(fen: string): Promise<TablebaseResult | null> {
  const clean = fen.trim();
  if (!clean) return null;

  // Syzygy tablebases only cover positions with at most 7 pieces.
  if (pieceCount(clean) > 7) return null;

  let base: string;
  try {
    const settings = await loadSettings();
    base = (settings.syzygyApiUrl || 'https://tablebase.lichess.ovh').trim();
  } catch {
    base = 'https://tablebase.lichess.ovh';
  }
  if (!base) return null;

  // Strip a trailing slash so we don't produce "//standard".
  const root = base.replace(/\/+$/, '');
  const url = `${root}/standard?fen=${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return null;

    const obj = data as Record<string, unknown>;
    const rawMoves = Array.isArray(obj.moves) ? obj.moves : [];

    const moves: TablebaseMove[] = [];
    for (const m of rawMoves) {
      if (!m || typeof m !== 'object') continue;
      const mv = m as Record<string, unknown>;
      const uci = typeof mv.uci === 'string' ? mv.uci : '';
      if (!uci) continue;
      moves.push({
        uci,
        san: typeof mv.san === 'string' ? mv.san : uci,
        category: typeof mv.category === 'string' ? mv.category : 'unknown',
        dtz: asNumOrNull(mv.dtz),
        dtm: asNumOrNull(mv.dtm),
        zeroing: typeof mv.zeroing === 'boolean' ? mv.zeroing : undefined,
      });
    }

    return {
      category: typeof obj.category === 'string' ? obj.category : 'unknown',
      dtz: asNumOrNull(obj.dtz),
      dtm: asNumOrNull(obj.dtm),
      moves,
    };
  } catch {
    // Network error, CORS, timeout, bad JSON — treat all as "no data".
    return null;
  }
}

/**
 * The single best move for the side to move: the Lichess tablebase returns
 * `moves` already sorted best-first, so we take the head of the list.
 * Returns null when there are no moves (terminal position or empty result).
 */
export function bestTablebaseMove(res: TablebaseResult | null): TablebaseMove | null {
  if (!res || res.moves.length === 0) return null;
  return res.moves[0];
}
