/**
 * Offscreen document script — runs Stockfish WASM in the extension's own origin.
 *
 * The content script cannot create Workers from chrome-extension:// URLs due to
 * same-origin restrictions. This offscreen document runs in the extension's context,
 * so Worker creation and WASM compilation work perfectly.
 *
 * Communication: content script → chrome.runtime.sendMessage → background →
 *   chrome.runtime.sendMessage → offscreen → Stockfish Worker → back up the chain.
 */

let worker: Worker | null = null;
let ready = false;

function createStockfishWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    try {
      const url = chrome.runtime.getURL('stockfish/stockfish.js');
      const w = new Worker(url);
      w.onerror = (e) => {
        console.error('[BoardGPT offscreen] Worker error:', e);
        reject(new Error('stockfish worker failed'));
      };
      // Wait for the worker to be alive
      const timeout = setTimeout(() => {
        w.removeEventListener('message', handler);
        reject(new Error('stockfish uciok timeout'));
      }, 10000);
      const handler = (ev: MessageEvent) => {
        const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
        if (line.includes('uciok')) {
          clearTimeout(timeout);
          w.removeEventListener('message', handler);
          resolve(w);
        }
      };
      w.addEventListener('message', handler);
      w.postMessage('uci');
    } catch (e) {
      reject(e);
    }
  });
}

async function ensureWorker(): Promise<Worker> {
  if (worker && ready) return worker;
  worker = await createStockfishWorker();
  ready = true;
  console.log('[BoardGPT offscreen] ⚡ Stockfish WASM connected!');
  return worker;
}

function sendCmd(
  w: Worker,
  cmd: string,
  until: (line: string) => boolean,
  timeoutMs: number,
  onLine?: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      w.removeEventListener('message', handler);
      reject(new Error(`timeout after "${cmd}"`));
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
  if (!line.startsWith('info') || !line.includes(' multipv ')) return null;
  const mpv = parseInt(line.match(/ multipv (\d+)/)?.[1] ?? '0', 10);
  const cpMatch = line.match(/ score cp (-?\d+)/);
  const mateMatch = line.match(/ score mate (-?\d+)/);
  const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
  if (!pvMatch) return null;
  return {
    multipv: mpv,
    cp: cpMatch ? parseInt(cpMatch[1], 10) : mateMatch ? (parseInt(mateMatch[1], 10) > 0 ? 30000 : -30000) : 0,
    mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
    firstMoveUci: pvMatch[1],
  };
}

// Listen for analysis requests from background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'stockfish-analyze') return false;

  const { fen, multipv, depth } = msg;

  (async () => {
    try {
      const w = await ensureWorker();

      await sendCmd(w, 'isready', (l) => l.includes('readyok'), 10000);
      await sendCmd(w, `setoption name MultiPV value ${multipv}`, () => true, 200).catch(() => {});
      w.postMessage(`position fen ${fen}`);

      const best = new Map<number, InfoLine>();
      await sendCmd(
        w,
        `go depth ${depth} multipv ${multipv}`,
        (l) => l.startsWith('bestmove'),
        15000,
        (line) => {
          const info = parseInfo(line);
          if (info) best.set(info.multipv, info);
        },
      );

      const lines: Array<{ uci: string; cp: number; mate: number | null }> = [];
      for (let i = 1; i <= multipv; i++) {
        const info = best.get(i);
        if (!info) continue;
        lines.push({ uci: info.firstMoveUci, cp: info.cp, mate: info.mate });
      }

      sendResponse({ ok: true, lines });
    } catch (e: any) {
      console.error('[BoardGPT offscreen] Analysis failed:', e);
      ready = false;
      worker = null;
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();

  return true; // Keep the message channel open for async response
});

// Signal that the offscreen document is ready
chrome.runtime.sendMessage({ type: 'stockfish-offscreen-ready' }).catch(() => {});
