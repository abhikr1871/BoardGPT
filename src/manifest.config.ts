import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

// Manifest V3 configuration. See blueprint §4 (Chrome Extension MV3) and §12.
export default defineManifest({
  manifest_version: 3,
  name: 'BoardGPT',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'BoardGPT',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  // Required so the offscreen document can compile the Stockfish WASM binary.
  // Without 'wasm-unsafe-eval' MV3 blocks WebAssembly.instantiate on extension pages.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  permissions: ['storage', 'activeTab', 'scripting', 'tabs', 'offscreen'],
  host_permissions: [
    'https://www.chess.com/*',
    'https://lichess.org/*',
    'https://chess24.com/*',
    'https://api.anthropic.com/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
    'https://api.chessai.app/*',
  ],
  content_scripts: [
    {
      matches: [
        'https://www.chess.com/*',
        'https://lichess.org/*',
        'https://chess24.com/*',
      ],
      js: ['src/content/content.tsx'],
      run_at: 'document_idle',
    },
  ],
  commands: {
    'toggle-overlay': {
      suggested_key: { default: 'Alt+C' },
      description: 'Toggle the BoardGPT overlay',
    },
  },
  web_accessible_resources: [
    {
      resources: ['assets/*', 'icons/*', 'stockfish/*', 'src/offscreen/offscreen.html', 'src/dashboard/index.html', 'src/options/index.html'],
      matches: ['<all_urls>'],
    },
  ],
});
