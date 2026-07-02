# BoardGPT — Extension

Real-time chess board analysis, best-move suggestions and AI coaching, delivered as a
Chrome (Manifest V3) extension. This repository is the **Phase 1 foundation + working demo**
from the [project blueprint](./Chess_AI_Agent_Blueprint.pdf).

> Board input in this build is **manual FEN entry** (blueprint's Phase 2 covers the
> OpenCV + CNN screen-vision pipeline). Everything downstream of the FEN — engine
> analysis, ranked move cards, natural-language explanations and post-game review — is
> live and functional.

## What works today

- **Analyze any position** — paste a FEN in the popup or the on-page overlay and get the
  top moves ranked with an evaluation bar, BEST/GOOD/EQUAL pills and centipawn scores.
- **Two engines, automatic fallback** — uses Stockfish 16 (WASM) when present, otherwise a
  built-in negamax + alpha-beta engine (material + piece-square tables) so the demo runs
  with zero setup.
- **Natural-language coaching** — each move gets a plain-English explanation. With an
  Anthropic API key it calls Claude; without one it uses a solid rule-based explainer.
- **On-page overlay** — draggable, collapsible, corner-positioned panel injected on
  Chess.com / Lichess / Chess24. Toggle with **Alt+C**.
- **Post-game analysis dashboard** — paste a PGN to get per-move classification
  (`!! ! ?! ? ??`), per-side accuracy, an accuracy graph, critical-moment highlighting,
  opening detection and an AI coaching summary.
- **Settings page** — analysis depth, number of moves, verbosity, overlay position,
  Claude model and API key.

## Architecture (blueprint §2)

```
Popup / Overlay / Dashboard (React + Tailwind)   ← Presentation Layer
        │
        ▼
  analysis.ts  ──►  Stockfish 16 (WASM, UCI)      ← Engine Layer (preferred)
        │      └─►  builtinEngine.ts (negamax)    ← Engine Layer (fallback)
        │      └─►  claude.ts (explanations)
        ▼
   chess.js (FEN/PGN, legal moves, game state)
```

The MV3 service worker stays light (settings + the Alt+C command); heavy engine work runs
in the page/UI context because service workers can't spawn the Stockfish sub-worker.

## Project layout

```
src/
  manifest.config.ts     MV3 manifest (CRXJS)
  types.ts               shared types + messaging contract + default settings
  lib/
    evaluation.ts        centipawn → label/color bands, eval-bar math
    storage.ts           chrome.storage settings (safe outside the extension too)
  engine/
    builtinEngine.ts     negamax + alpha-beta + PST evaluation (always available)
    stockfish.ts         Stockfish 16 WASM UCI worker wrapper (preferred)
    analysis.ts          engine selection, phase detection, labelling
    claude.ts            Anthropic API client + heuristic fallback explainer
    postgame.ts          PGN review: classification, accuracy, coaching
  components/            EvalBar, MoveCard, AnalysisPanel (shared UI)
  overlay/               draggable on-page overlay
  content/               content-script entry (injects the overlay)
  background/            MV3 service worker
  popup/ options/ dashboard/   the three extension pages
test/                    Node tests for the engine + post-game logic
```

## Develop / build

```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # type-check + production build → dist/
npm test         # engine + post-game unit tests (Node, no browser)
```

### Load the unpacked extension

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` folder.
4. Click the toolbar icon (popup) or visit Lichess/Chess.com and press **Alt+C**.

### Enabling real Stockfish (optional)

Drop a single-threaded Stockfish build at `public/stockfish/stockfish.js` (e.g. the
`stockfish.js` npm package's single-file WASM build). The engine auto-detects it and uses
it in place of the built-in engine. No file → the built-in engine is used automatically.

### Enabling Claude explanations (optional)

Open the extension **Settings**, paste an Anthropic API key and set the model
(default `claude-sonnet-5`). Without a key the built-in heuristic explainer is used.

## Roadmap (blueprint §9)

- **Phase 1 – Foundation ✅** (this repo): scaffold, engine, explanations, overlay, popup,
  options, post-game dashboard.
- **Phase 2 – Vision Core**: OpenCV board detection + CNN piece classifier → automatic FEN.
- **Phase 3 – AI Engine**: full Stockfish WASM depth-18 pipeline + Redis caching.
- **Phase 4 – UI/UX**: board arrows, hotkey remapping, responsive polish.
- **Phase 5 – Launch**: Chrome Web Store + Electron desktop packaging.
