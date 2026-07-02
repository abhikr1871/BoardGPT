import type { RawLine } from './builtinEngine';
import { Chess } from 'chess.js';

/**
 * Stockfish 16 (WASM) — via offscreen document.
 *
 * Content scripts cannot create Web Workers pointing at chrome-extension:// URLs
 * due to same-origin restrictions. Instead, we send analysis requests to the
 * background service worker, which forwards them to an offscreen document that
 * hosts the actual Stockfish WASM Worker.
 *
 * This approach guarantees:
 * - Stockfish runs off the main thread (no UI freezing)
 * - WASM compilation works (offscreen doc runs in extension origin)
 * - The content script's UI thread stays completely free
 */

let available: boolean | null = null;

/** Returns true if the offscreen Stockfish engine can be reached. */
export async function isStockfishAvailable(): Promise<boolean> {
  if (available === true) return true;

  // Check if we're in a context where chrome.runtime.sendMessage is available
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    available = null;
    return false;
  }

  try {
    // Send a probe request with a simple starting position
    const result = await chrome.runtime.sendMessage({
      type: 'stockfish-analyze',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      multipv: 1,
      depth: 5,
    });

    if (result?.ok) {
      available = true;
      console.log('[BoardGPT] ⚡ Stockfish 16 WASM connected via offscreen document!');
      return true;
    } else {
      console.warn('[BoardGPT] Stockfish probe returned error:', result?.error);
      available = null;
      return false;
    }
  } catch (err) {
    console.warn('[BoardGPT] Stockfish probe failed:', err);
    available = null;
    return false;
  }
}

function uciToSan(chess: Chess, uci: string): string {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    const m = chess.move({ from, to, promotion });
    const san = m.san;
    chess.undo();
    return san;
  } catch {
    return uci;
  }
}

/** Analyse a FEN with Stockfish via offscreen document. Throws if unavailable. */
export async function analyzeWithStockfish(
  fen: string,
  multipv = 3,
  depth = 18,
): Promise<RawLine[]> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('stockfish unavailable');
  }

  const result = await chrome.runtime.sendMessage({
    type: 'stockfish-analyze',
    fen,
    multipv,
    depth,
  });

  if (!result?.ok) {
    available = null; // Reset so it retries
    throw new Error(result?.error || 'stockfish analysis failed');
  }

  const chess = new Chess(fen);
  const lines: RawLine[] = (result.lines || []).map(
    (info: { uci: string; cp: number; mate: number | null }) => ({
      uci: info.uci,
      san: uciToSan(chess, info.uci),
      cp: info.cp,
      mate: info.mate,
    }),
  );

  if (lines.length === 0) throw new Error('no stockfish lines');
  return lines;
}
