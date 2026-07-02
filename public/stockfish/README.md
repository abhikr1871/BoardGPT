# Stockfish engine (optional)

Drop a **single-threaded** Stockfish WASM build here as `stockfish.js` (plus its
`stockfish.wasm` if the build ships one). Single-threaded avoids the COOP/COEP header
requirement, so it runs inside the extension without extra configuration.

Where to get one:
- npm: `stockfish` package (`node_modules/stockfish/src/stockfish-single.js` → rename to `stockfish.js`)
- or any `stockfish.js` classic-worker build.

The wrapper in `src/engine/stockfish.ts` loads `chrome.runtime.getURL('stockfish/stockfish.js')`
as a Web Worker and speaks UCI. If this file is missing, the extension automatically falls
back to the built-in engine — the demo works either way.
