/**
 * Offscreen engine host.
 *
 * Runs in the extension's OWN origin (chrome-extension://…) so it can:
 *   - create a Web Worker from a chrome-extension:// URL (blocked in content scripts)
 *   - compile the Stockfish WASM (allowed by the extension_pages CSP wasm-unsafe-eval)
 *
 * It owns BOTH engines so the page's main thread never computes:
 *   - Stockfish 18 WASM in a Worker thread (preferred, depth 18)
 *   - the built-in negamax engine, run here (not on chess.com's thread) as fallback
 *
 * Transport: a single long-lived port to the background service worker
 * (chrome.runtime.connect). The connection itself is the "ready" signal — it is
 * only opened once this script has executed and the listener exists, which fixes
 * the earlier race where messages were sent before the listener was registered.
 * Using a port (not chrome.runtime.sendMessage) also removes the message-loop bug.
 */
import { analyzePosition, type RawLine } from '../engine/builtinEngine';
import { getCachedEval, putCachedEval } from '../engine/evalCache';

const PORT_NAME = 'boardgpt-engine';
const STOCKFISH_URL = 'stockfish/stockfish.js';

type EngineName = 'stockfish' | 'builtin';
interface AnalyzeMsg {
  type: 'analyze';
  requestId: string;
  fen: string;
  multipv: number;
  depth: number;
}

// ─── Stockfish worker lifecycle (non-blocking) ──────────────────────────────
let sfWorker: Worker | null = null;
let sfState: 'idle' | 'starting' | 'ready' | 'failed' = 'idle';
let sfLastTry = 0;
const SF_RETRY_MS = 30_000;

function startStockfish(): void {
  const now = Date.now();
  if (sfState === 'starting' || sfState === 'ready') return;
  if (sfState === 'failed' && now - sfLastTry < SF_RETRY_MS) return;
  sfState = 'starting';
  sfLastTry = now;

  try {
    const url = chrome.runtime.getURL(STOCKFISH_URL);
    const w = new Worker(url);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[BoardGPT offscreen] Stockfish uciok timeout — using built-in engine');
      sfState = 'failed';
      try { w.terminate(); } catch {}
    }, 15_000);

    const onBoot = (ev: MessageEvent) => {
      const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
      if (line.includes('uciok')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        w.removeEventListener('message', onBoot);
        sfWorker = w;
        sfState = 'ready';
        console.log('[BoardGPT offscreen] ⚡ Stockfish WASM ready');
      }
    };
    w.addEventListener('message', onBoot);
    w.onerror = (e: ErrorEvent | Event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      console.warn('[BoardGPT offscreen] Stockfish worker error:', (e as ErrorEvent).message || e);
      sfState = 'failed';
      try { w.terminate(); } catch {}
    };
    w.postMessage('uci');
  } catch (e) {
    console.warn('[BoardGPT offscreen] Stockfish spawn failed:', e);
    sfState = 'failed';
  }
}

function parseInfo(line: string): { multipv: number; cp: number; mate: number | null; uci: string } | null {
  if (!line.startsWith('info') || !line.includes(' multipv ') || !line.includes(' pv ')) return null;
  const mpv = /(?: |^)multipv (\d+)/.exec(line);
  const cp = / score cp (-?\d+)/.exec(line);
  const mate = / score mate (-?\d+)/.exec(line);
  const pv = / pv ([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
  if (!pv) return null;
  return {
    multipv: mpv ? parseInt(mpv[1], 10) : 1,
    cp: cp ? parseInt(cp[1], 10) : mate ? (parseInt(mate[1], 10) > 0 ? 30000 : -30000) : 0,
    mate: mate ? parseInt(mate[1], 10) : null,
    uci: pv[1],
  };
}

function sfSend(cmd: string, until: (l: string) => boolean, timeoutMs: number, onLine?: (l: string) => void): Promise<void> {
  const w = sfWorker!;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', handler);
      reject(new Error(`stockfish timeout after "${cmd}"`));
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

async function stockfishAnalyze(fen: string, multipv: number, depth: number): Promise<RawLine[]> {
  await sfSend('isready', (l) => l.includes('readyok'), 10_000);
  await sfSend(`setoption name MultiPV value ${multipv}`, () => true, 200).catch(() => {});
  sfWorker!.postMessage(`position fen ${fen}`);
  const best = new Map<number, { multipv: number; cp: number; mate: number | null; uci: string }>();
  await sfSend(`go depth ${depth} multipv ${multipv}`, (l) => l.startsWith('bestmove'), 15_000, (line) => {
    const info = parseInfo(line);
    if (info) best.set(info.multipv, info);
  });
  const lines: RawLine[] = [];
  for (let i = 1; i <= multipv; i++) {
    const info = best.get(i);
    if (info) lines.push({ uci: info.uci, san: info.uci, cp: info.cp, mate: info.mate });
  }
  if (!lines.length) throw new Error('no stockfish lines');
  return lines;
}

// Serialize engine work so concurrent requests never clash on the one worker.
let chain: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function analyze(msg: AnalyzeMsg): Promise<{ lines: RawLine[]; engine: EngineName }> {
  // Cache hit → instant (only trust cached Stockfish results, not the weaker builtin).
  const cached = await getCachedEval(msg.fen, msg.depth, msg.multipv);
  if (cached && cached.engine === 'stockfish' && cached.lines.length) {
    return { lines: cached.lines, engine: 'stockfish' };
  }

  if (sfState === 'ready' && sfWorker) {
    try {
      const lines = await stockfishAnalyze(msg.fen, msg.multipv, msg.depth);
      void putCachedEval(msg.fen, msg.depth, msg.multipv, {
        lines,
        engine: 'stockfish',
        depth: msg.depth,
        ts: Date.now(),
      });
      return { lines, engine: 'stockfish' };
    } catch (e) {
      console.warn('[BoardGPT offscreen] Stockfish analyze failed, falling back:', e);
      sfState = 'idle'; // let it re-init next time
      sfWorker = null;
    }
  } else {
    // Warm Stockfish up in the background for subsequent moves.
    startStockfish();
  }
  // Built-in engine runs HERE (offscreen thread), never on the page thread.
  const lines = analyzePosition(msg.fen, msg.multipv, 2);
  return { lines, engine: 'builtin' };
}

// ─── Port wiring (with auto-reconnect if the service worker restarts) ────────
function connect(): void {
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: PORT_NAME });
  } catch {
    setTimeout(connect, 1000);
    return;
  }
  port.onMessage.addListener((msg: AnalyzeMsg) => {
    if (msg?.type !== 'analyze') return;
    runExclusive(() => analyze(msg))
      .then((res) => port.postMessage({ requestId: msg.requestId, ok: true, ...res }))
      .catch((e) => port.postMessage({ requestId: msg.requestId, ok: false, error: String(e?.message || e) }));
  });
  port.onDisconnect.addListener(() => {
    // Service worker was suspended/restarted — reconnect shortly.
    setTimeout(connect, 500);
  });
}

connect();
// Kick off Stockfish init immediately so it's ready by the 1st or 2nd move.
startStockfish();
