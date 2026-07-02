import { loadSettings, saveSettings } from '../lib/storage';
import type { WorkerRequest } from '../types';

/**
 * Background service worker (MV3).
 *
 * Responsibilities:
 *  - settings + game-save relay
 *  - Alt+C command relay
 *  - Stockfish/engine offscreen document lifecycle and message routing
 *
 * Engine routing uses a long-lived PORT to the offscreen document (not
 * chrome.runtime.sendMessage), which fixes two earlier bugs:
 *   • message loop — a broadcast sendMessage re-triggered this worker's own listener
 *   • race — messages were sent before the offscreen listener existed
 * The offscreen doc opens the port only after its script runs, so a live port
 * is proof the engine is ready to receive requests.
 */

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
const ENGINE_PORT = 'boardgpt-engine';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[BoardGPT] installed');
});

// Relay the Alt+C command to the active tab's content script.
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' }).catch(() => {});
  }
});

// ── Offscreen document + engine port ─────────────────────────────────────────
let enginePort: chrome.runtime.Port | null = null;
let portWaiters: Array<(p: chrome.runtime.Port | null) => void> = [];
let creating: Promise<void> | null = null;
const pending = new Map<string, (msg: any) => void>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== ENGINE_PORT) return;
  enginePort = port;
  portWaiters.splice(0).forEach((w) => w(port));

  port.onMessage.addListener((msg: { requestId: string }) => {
    const resolve = pending.get(msg.requestId);
    if (resolve) {
      pending.delete(msg.requestId);
      resolve(msg);
    }
  });
  port.onDisconnect.addListener(() => {
    enginePort = null;
  });
});

async function hasOffscreen(): Promise<boolean> {
  const runtime = chrome.runtime as any;
  if (runtime.getContexts) {
    const ctx = await runtime
      .getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
      .catch(() => []);
    return Array.isArray(ctx) && ctx.length > 0;
  }
  // fallback to the older API
  return (await (chrome.offscreen as any)?.hasDocument?.().catch(() => false)) ?? false;
}

async function ensureOffscreen(): Promise<void> {
  if (typeof chrome.offscreen === 'undefined') throw new Error('chrome.offscreen unavailable');
  if (await hasOffscreen()) return;
  if (creating) return creating;
  creating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Run the Stockfish WASM chess engine in a Worker off the page thread',
      });
    } finally {
      creating = null;
    }
  })();
  return creating;
}

/** Ensure the offscreen doc exists and its engine port is connected. */
async function ensureEnginePort(): Promise<chrome.runtime.Port | null> {
  if (enginePort) return enginePort;
  await ensureOffscreen().catch((e) => console.warn('[BoardGPT] ensureOffscreen:', e));
  if (enginePort) return enginePort;
  // Wait for the offscreen document to open its port.
  return new Promise((resolve) => {
    portWaiters.push(resolve);
    setTimeout(() => {
      portWaiters = portWaiters.filter((w) => w !== resolve);
      resolve(enginePort);
    }, 4000);
  });
}

async function routeEngineAnalyze(req: any): Promise<any> {
  const port = await ensureEnginePort();
  if (!port) return { ok: false, error: 'offscreen engine unavailable' };
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    const timer = setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        resolve({ ok: false, error: 'engine timeout' });
      }
    }, 20_000);
    try {
      port.postMessage({
        type: 'analyze',
        requestId,
        fen: req.fen,
        multipv: req.multipv,
        depth: req.depth,
      });
    } catch (e) {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve({ ok: false, error: String(e) });
    }
  });
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((req: any, _sender, sendResponse: (r: any) => void) => {
  // Engine analysis from any context (content script, popup, dashboard).
  if (req?.type === 'ENGINE_ANALYZE') {
    routeEngineAnalyze(req).then(sendResponse);
    return true;
  }

  const typedReq = req as WorkerRequest;
  (async () => {
    try {
      if (typedReq.type === 'GET_SETTINGS') {
        sendResponse({ type: 'SETTINGS', settings: await loadSettings() });
      } else if (typedReq.type === 'SAVE_SETTINGS') {
        sendResponse({ type: 'SETTINGS', settings: await saveSettings(typedReq.settings) });
      } else if (typedReq.type === 'SAVE_GAME') {
        const settings = await loadSettings();
        if (!settings.apiBaseUrl) {
          sendResponse({ type: 'ERROR', message: 'No backend configured' });
          return;
        }
        const res = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/api/games`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(settings.apiToken ? { authorization: `Bearer ${settings.apiToken}` } : {}),
          },
          body: JSON.stringify(typedReq.game),
        });
        if (!res.ok) throw new Error(`backend ${res.status}`);
        const data = await res.json().catch(() => ({}));
        sendResponse({ type: 'GAME_SAVED', id: typedReq.game.id, serverId: data?.id });
      } else {
        sendResponse({ type: 'ERROR', message: `Unhandled request: ${(typedReq as any).type}` });
      }
    } catch (e) {
      sendResponse({ type: 'ERROR', message: (e as Error).message });
    }
  })();
  return true; // async response
});
