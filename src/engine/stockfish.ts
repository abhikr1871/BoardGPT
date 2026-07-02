import type { RawLine } from './builtinEngine';
import { Chess } from 'chess.js';

/**
 * Engine client (runs in the content script / popup / dashboard).
 *
 * All heavy computation happens in the offscreen document. This module just
 * sends an ENGINE_ANALYZE message to the background service worker and awaits
 * the result — so the page's main thread is NEVER blocked by engine work.
 *
 * Returns null when the extension messaging bus isn't available (e.g. unit
 * tests or a plain web preview), so callers can fall back to a local engine.
 */

export interface EngineAnalysis {
  lines: RawLine[];
  engine: 'stockfish' | 'builtin';
}

function messagingAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
}

/** Ask the offscreen engine to analyse a FEN. Resolves null if unavailable/failed. */
export async function requestEngineAnalysis(
  fen: string,
  multipv = 3,
  depth = 18,
): Promise<EngineAnalysis | null> {
  if (!messagingAvailable()) return null;
  try {
    const res: any = await chrome.runtime.sendMessage({
      type: 'ENGINE_ANALYZE',
      fen,
      multipv,
      depth,
    });
    if (!res?.ok || !Array.isArray(res.lines) || res.lines.length === 0) return null;

    // The offscreen engine returns UCI + scores; fill in SAN here.
    const chess = new Chess(fen);
    const lines: RawLine[] = res.lines.map((l: { uci: string; cp: number; mate: number | null }) => ({
      uci: l.uci,
      san: uciToSan(chess, l.uci),
      cp: l.cp,
      mate: l.mate,
    }));
    return { lines, engine: res.engine === 'stockfish' ? 'stockfish' : 'builtin' };
  } catch {
    return null;
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
