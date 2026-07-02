import { loadSettings, saveSettings } from '../lib/storage';
import type { WorkerRequest, WorkerResponse } from '../types';

/**
 * Background service worker (MV3). Handles settings, keyboard commands,
 * and the Stockfish offscreen document lifecycle.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChessAI] installed');
});

// Relay the Alt+C command to the active tab's content script.
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-overlay') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' }).catch(() => {});
  }
});

// ── Offscreen document management for Stockfish ──────────────────────

let offscreenCreating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  // @ts-ignore — chrome.offscreen types may not be in older @types/chrome
  if (typeof chrome.offscreen === 'undefined') {
    throw new Error('chrome.offscreen API not available');
  }

  // Check if already exists
  // @ts-ignore
  const existing = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (existing) return;

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = (async () => {
    try {
      // @ts-ignore
      await chrome.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Run Stockfish WASM chess engine in a Web Worker',
      });
      console.log('[BoardGPT] Offscreen document created for Stockfish');
    } finally {
      offscreenCreating = null;
    }
  })();

  await offscreenCreating;
}

// ── Message handler ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (req: any, sender, sendResponse: (r: any) => void) => {
    // Stockfish analysis request from content script → relay to offscreen
    if (req.type === 'stockfish-analyze') {
      (async () => {
        try {
          await ensureOffscreen();
          // Forward the request; the offscreen doc will respond
          const result = await chrome.runtime.sendMessage(req);
          sendResponse(result);
        } catch (e: any) {
          console.warn('[BoardGPT] offscreen relay failed:', e);
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }

    // Ignore offscreen-ready signal
    if (req.type === 'stockfish-offscreen-ready') return false;

    // Original settings / game saving logic
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
          sendResponse({ type: 'ERROR', message: `Unhandled request: ${typedReq.type}` });
        }
      } catch (e) {
        sendResponse({ type: 'ERROR', message: (e as Error).message });
      }
    })();
    return true; // async response
  },
);

