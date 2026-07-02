import type { RawLine } from './builtinEngine';
import { Chess } from 'chess.js';

/**
 * Stockfish 16 (WASM) UCI wrapper — the preferred engine per blueprint §6.
 *
 * Stockfish is loaded as a classic Web Worker from a file you drop into
 * `public/stockfish/stockfish.js` (single-threaded build so it works without
 * COOP/COEP headers inside an extension). If that file is absent or the engine
 * fails to start, callers transparently fall back to the built-in engine.
 *
 * The worker speaks the UCI protocol:
 *   uci → uciok
 *   isready → readyok
 *   position fen <FEN>
 *   go depth <d> multipv <n>  →  info ... multipv k ... score cp/mate ... pv <move> ...
 *   ... bestmove <move>
 */

const WORKER_PATH = 'stockfish/stockfish.js';

let worker: Worker | null = null;
let available: boolean | null = null;

function resolveWorkerUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(WORKER_PATH);
  }
  return WORKER_PATH;
}

/** Returns true if a Stockfish worker can be started. Cached after first probe. */
export async function isStockfishAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    const w = await createWorker();
    await send(w, 'uci', (line) => line.includes('uciok'), 2500);
    worker = w;
    available = true;
  } catch {
    available = false;
  }
  return available;
}

function createWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    try {
      const w = new Worker(resolveWorkerUrl());
      w.onerror = () => reject(new Error('stockfish worker failed to load'));
      resolve(w);
    } catch (e) {
      reject(e as Error);
    }
  });
}

/** Send a command and resolve when `until` matches a line, or reject on timeout. */
function send(
  w: Worker,
  cmd: string,
  until: (line: string) => boolean,
  timeoutMs: number,
  onLine?: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', handler);
      reject(new Error(`timeout waiting after "${cmd}"`));
    }, timeoutMs);
    const handler = (ev: MessageEvent) => {
      const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
      onLine?.(line);
      if (until(line)) {
        clearTimeout(timer);
        w.removeEventListener('message', handler);
        resolve();
      }
    };
    w.addEventListener('message', handler);
    w.postMessage(cmd);
  });
}

interface InfoLine {
  multipv: number;
  cp: number;
  mate: number | null;
  firstMoveUci: string;
}

function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info') || !line.includes(' pv ')) return null;
  const mpv = /multipv (\d+)/.exec(line);
  const cp = /score cp (-?\d+)/.exec(line);
  const mate = /score mate (-?\d+)/.exec(line);
  const pv = / pv (\S+)/.exec(line);
  if (!pv) return null;
  return {
    multipv: mpv ? parseInt(mpv[1], 10) : 1,
    cp: cp ? parseInt(cp[1], 10) : 0,
    mate: mate ? parseInt(mate[1], 10) : null,
    firstMoveUci: pv[1],
  };
}

/** Analyse a FEN with Stockfish. Throws if the engine is unavailable. */
export async function analyzeWithStockfish(
  fen: string,
  multipv = 3,
  depth = 18,
): Promise<RawLine[]> {
  const ok = await isStockfishAvailable();
  if (!ok || !worker) throw new Error('stockfish unavailable');
  const w = worker;

  await send(w, 'isready', (l) => l.includes('readyok'), 2500);
  await send(w, `setoption name MultiPV value ${multipv}`, () => true, 200).catch(() => {});
  w.postMessage(`position fen ${fen}`);

  const best = new Map<number, InfoLine>();
  await send(
    w,
    `go depth ${depth} multipv ${multipv}`,
    (l) => l.startsWith('bestmove'),
    15000,
    (line) => {
      const info = parseInfo(line);
      if (info) best.set(info.multipv, info);
    },
  );

  const chess = new Chess(fen);
  const lines: RawLine[] = [];
  for (let i = 1; i <= multipv; i++) {
    const info = best.get(i);
    if (!info) continue;
    const san = uciToSan(chess, info.firstMoveUci);
    lines.push({ uci: info.firstMoveUci, san, cp: info.cp, mate: info.mate });
  }
  return lines.length ? lines : Promise.reject(new Error('no stockfish lines'));
}

function uciToSan(chess: Chess, uci: string): string {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    const move = chess.move({ from, to, promotion });
    chess.undo();
    return move.san;
  } catch {
    return uci;
  }
}
