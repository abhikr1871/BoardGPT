#!/usr/bin/env node
/**
 * Copies the single-threaded "lite" Stockfish 18 build out of the installed
 * `stockfish` npm package into public/stockfish/ as stockfish.js + stockfish.wasm.
 *
 * Why single-threaded lite:
 *  - single-threaded needs no SharedArrayBuffer / COOP-COEP headers, so it runs
 *    inside the extension's offscreen document with zero special setup.
 *  - lite embeds a smaller NNUE net (~7 MB) so there is no network download.
 *
 * Why these exact names: the Stockfish loader derives its wasm URL by taking its
 * own script URL and replacing `.js` → `.wasm`. So the worker script MUST be
 * named stockfish.js and the wasm stockfish.wasm, living side by side.
 *
 * Runs automatically on `postinstall` and `prebuild`. Safe to run repeatedly.
 */
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const binDir = join(root, 'node_modules', 'stockfish', 'bin');
const outDir = join(root, 'public', 'stockfish');

const SRC_JS = join(binDir, 'stockfish-18-lite-single.js');
const SRC_WASM = join(binDir, 'stockfish-18-lite-single.wasm');
const OUT_JS = join(outDir, 'stockfish.js');
const OUT_WASM = join(outDir, 'stockfish.wasm');

function main() {
  if (!existsSync(SRC_JS) || !existsSync(SRC_WASM)) {
    console.warn(
      '[copy-stockfish] stockfish package not found in node_modules — skipping. ' +
        'Run `npm install` first; the extension will use the built-in engine until then.',
    );
    return;
  }
  mkdirSync(outDir, { recursive: true });
  copyFileSync(SRC_JS, OUT_JS);
  copyFileSync(SRC_WASM, OUT_WASM);
  const mb = (statSync(OUT_WASM).size / 1024 / 1024).toFixed(1);
  console.log(`[copy-stockfish] ✔ stockfish.js + stockfish.wasm (${mb} MB) → public/stockfish/`);
}

main();
