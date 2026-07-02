import { loadSettings, saveSettings } from '../lib/storage';
import type { WorkerRequest, WorkerResponse } from '../types';

/**
 * Background service worker (MV3). Kept intentionally light: it owns settings
 * persistence and the toggle-overlay keyboard command. Heavy engine work runs
 * in the page context (overlay) because MV3 service workers can't spawn the
 * Stockfish sub-worker or touch the DOM.
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

chrome.runtime.onMessage.addListener(
  (req: WorkerRequest, _sender, sendResponse: (r: WorkerResponse) => void) => {
    (async () => {
      try {
        if (req.type === 'GET_SETTINGS') {
          sendResponse({ type: 'SETTINGS', settings: await loadSettings() });
        } else if (req.type === 'SAVE_SETTINGS') {
          sendResponse({ type: 'SETTINGS', settings: await saveSettings(req.settings) });
        } else if (req.type === 'SAVE_GAME') {
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
            body: JSON.stringify(req.game),
          });
          if (!res.ok) throw new Error(`backend ${res.status}`);
          const data = await res.json().catch(() => ({}));
          sendResponse({ type: 'GAME_SAVED', id: req.game.id, serverId: data?.id });
        } else {
          sendResponse({ type: 'ERROR', message: `Unhandled request: ${req.type}` });
        }
      } catch (e) {
        sendResponse({ type: 'ERROR', message: (e as Error).message });
      }
    })();
    return true; // async response
  },
);
