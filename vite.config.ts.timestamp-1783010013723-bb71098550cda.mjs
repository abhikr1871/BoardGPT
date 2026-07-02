// vite.config.ts
import { defineConfig } from "file:///sessions/adoring-gallant-hopper/mnt/BoardGPT/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/adoring-gallant-hopper/mnt/BoardGPT/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///sessions/adoring-gallant-hopper/mnt/BoardGPT/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// src/manifest.config.ts
import { defineManifest } from "file:///sessions/adoring-gallant-hopper/mnt/BoardGPT/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "boardgpt",
  version: "0.1.0",
  description: "Real-time chess board analysis, best-move suggestions and AI coaching as a Chrome extension \u2014 BoardGPT.",
  type: "module",
  license: "MIT",
  scripts: {
    postinstall: "node scripts/copy-stockfish.mjs",
    prebuild: "node scripts/copy-stockfish.mjs",
    dev: "node scripts/copy-stockfish.mjs && vite",
    build: "node scripts/copy-stockfish.mjs && tsc --noEmit && vite build",
    "build:nocheck": "node scripts/copy-stockfish.mjs && vite build",
    preview: "vite preview",
    test: "node --import tsx --test test/engine.test.ts"
  },
  dependencies: {
    "chess.js": "^1.0.0-beta.8",
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    stockfish: "^18.0.8"
  },
  devDependencies: {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@types/chrome": "^0.0.270",
    "@types/node": "^20.19.43",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    autoprefixer: "^10.4.19",
    postcss: "^8.4.39",
    tailwindcss: "^3.4.7",
    tsx: "^4.16.2",
    typescript: "^5.5.4",
    vite: "^5.4.0"
  }
};

// src/manifest.config.ts
var manifest_config_default = defineManifest({
  manifest_version: 3,
  name: "BoardGPT",
  version: package_default.version,
  description: package_default.description,
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png"
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "BoardGPT"
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module"
  },
  // Required so the offscreen document can compile the Stockfish WASM binary.
  // Without 'wasm-unsafe-eval' MV3 blocks WebAssembly.instantiate on extension pages.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  permissions: ["storage", "activeTab", "scripting", "tabs", "offscreen"],
  host_permissions: [
    "https://www.chess.com/*",
    "https://lichess.org/*",
    "https://chess24.com/*",
    "https://api.anthropic.com/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
    "https://api.chessai.app/*"
  ],
  content_scripts: [
    {
      matches: [
        "https://www.chess.com/*",
        "https://lichess.org/*",
        "https://chess24.com/*"
      ],
      js: ["src/content/content.tsx"],
      run_at: "document_idle"
    }
  ],
  commands: {
    "toggle-overlay": {
      suggested_key: { default: "Alt+C" },
      description: "Toggle the BoardGPT overlay"
    }
  },
  web_accessible_resources: [
    {
      resources: ["assets/*", "icons/*", "stockfish/*", "src/offscreen/offscreen.html"],
      matches: ["<all_urls>"]
    }
  ]
});

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [react(), crx({ manifest: manifest_config_default })],
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        popup: "src/popup/index.html",
        options: "src/options/index.html",
        dashboard: "src/dashboard/index.html",
        offscreen: "src/offscreen/offscreen.html"
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LmNvbmZpZy50cyIsICJwYWNrYWdlLmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvQm9hcmRHUFRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWdhbGxhbnQtaG9wcGVyL21udC9Cb2FyZEdQVC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvQm9hcmRHUFQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LmNvbmZpZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBjcngoeyBtYW5pZmVzdCB9KV0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBwb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICAgICAgb3B0aW9uczogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICAgICAgICBkYXNoYm9hcmQ6ICdzcmMvZGFzaGJvYXJkL2luZGV4Lmh0bWwnLFxuICAgICAgICBvZmZzY3JlZW46ICdzcmMvb2Zmc2NyZWVuL29mZnNjcmVlbi5odG1sJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhtcjogeyBwb3J0OiA1MTczIH0sXG4gIH0sXG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyY1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVNYW5pZmVzdCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbi8vIE1hbmlmZXN0IFYzIGNvbmZpZ3VyYXRpb24uIFNlZSBibHVlcHJpbnQgXHUwMEE3NCAoQ2hyb21lIEV4dGVuc2lvbiBNVjMpIGFuZCBcdTAwQTcxMi5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZU1hbmlmZXN0KHtcbiAgbWFuaWZlc3RfdmVyc2lvbjogMyxcbiAgbmFtZTogJ0JvYXJkR1BUJyxcbiAgdmVyc2lvbjogcGtnLnZlcnNpb24sXG4gIGRlc2NyaXB0aW9uOiBwa2cuZGVzY3JpcHRpb24sXG4gIGljb25zOiB7XG4gICAgMTY6ICdpY29ucy9pY29uMTYucG5nJyxcbiAgICA0ODogJ2ljb25zL2ljb240OC5wbmcnLFxuICAgIDEyODogJ2ljb25zL2ljb24xMjgucG5nJyxcbiAgfSxcbiAgYWN0aW9uOiB7XG4gICAgZGVmYXVsdF9wb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICBkZWZhdWx0X3RpdGxlOiAnQm9hcmRHUFQnLFxuICB9LFxuICBvcHRpb25zX3BhZ2U6ICdzcmMvb3B0aW9ucy9pbmRleC5odG1sJyxcbiAgYmFja2dyb3VuZDoge1xuICAgIHNlcnZpY2Vfd29ya2VyOiAnc3JjL2JhY2tncm91bmQvc2VydmljZS13b3JrZXIudHMnLFxuICAgIHR5cGU6ICdtb2R1bGUnLFxuICB9LFxuICAvLyBSZXF1aXJlZCBzbyB0aGUgb2Zmc2NyZWVuIGRvY3VtZW50IGNhbiBjb21waWxlIHRoZSBTdG9ja2Zpc2ggV0FTTSBiaW5hcnkuXG4gIC8vIFdpdGhvdXQgJ3dhc20tdW5zYWZlLWV2YWwnIE1WMyBibG9ja3MgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUgb24gZXh0ZW5zaW9uIHBhZ2VzLlxuICBjb250ZW50X3NlY3VyaXR5X3BvbGljeToge1xuICAgIGV4dGVuc2lvbl9wYWdlczogXCJzY3JpcHQtc3JjICdzZWxmJyAnd2FzbS11bnNhZmUtZXZhbCc7IG9iamVjdC1zcmMgJ3NlbGYnXCIsXG4gIH0sXG4gIHBlcm1pc3Npb25zOiBbJ3N0b3JhZ2UnLCAnYWN0aXZlVGFiJywgJ3NjcmlwdGluZycsICd0YWJzJywgJ29mZnNjcmVlbiddLFxuICBob3N0X3Blcm1pc3Npb25zOiBbXG4gICAgJ2h0dHBzOi8vd3d3LmNoZXNzLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly9saWNoZXNzLm9yZy8qJyxcbiAgICAnaHR0cHM6Ly9jaGVzczI0LmNvbS8qJyxcbiAgICAnaHR0cHM6Ly9hcGkuYW50aHJvcGljLmNvbS8qJyxcbiAgICAnaHR0cDovL2xvY2FsaG9zdC8qJyxcbiAgICAnaHR0cDovLzEyNy4wLjAuMS8qJyxcbiAgICAnaHR0cHM6Ly9hcGkuY2hlc3NhaS5hcHAvKicsXG4gIF0sXG4gIGNvbnRlbnRfc2NyaXB0czogW1xuICAgIHtcbiAgICAgIG1hdGNoZXM6IFtcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmNoZXNzLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vbGljaGVzcy5vcmcvKicsXG4gICAgICAgICdodHRwczovL2NoZXNzMjQuY29tLyonLFxuICAgICAgXSxcbiAgICAgIGpzOiBbJ3NyYy9jb250ZW50L2NvbnRlbnQudHN4J10sXG4gICAgICBydW5fYXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgICB9LFxuICBdLFxuICBjb21tYW5kczoge1xuICAgICd0b2dnbGUtb3ZlcmxheSc6IHtcbiAgICAgIHN1Z2dlc3RlZF9rZXk6IHsgZGVmYXVsdDogJ0FsdCtDJyB9LFxuICAgICAgZGVzY3JpcHRpb246ICdUb2dnbGUgdGhlIEJvYXJkR1BUIG92ZXJsYXknLFxuICAgIH0sXG4gIH0sXG4gIHdlYl9hY2Nlc3NpYmxlX3Jlc291cmNlczogW1xuICAgIHtcbiAgICAgIHJlc291cmNlczogWydhc3NldHMvKicsICdpY29ucy8qJywgJ3N0b2NrZmlzaC8qJywgJ3NyYy9vZmZzY3JlZW4vb2Zmc2NyZWVuLmh0bWwnXSxcbiAgICAgIG1hdGNoZXM6IFsnPGFsbF91cmxzPiddLFxuICAgIH0sXG4gIF0sXG59KTtcbiIsICJ7XG4gIFwibmFtZVwiOiBcImJvYXJkZ3B0XCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMS4wXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJSZWFsLXRpbWUgY2hlc3MgYm9hcmQgYW5hbHlzaXMsIGJlc3QtbW92ZSBzdWdnZXN0aW9ucyBhbmQgQUkgY29hY2hpbmcgYXMgYSBDaHJvbWUgZXh0ZW5zaW9uIFx1MjAxNCBCb2FyZEdQVC5cIixcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXG4gIFwibGljZW5zZVwiOiBcIk1JVFwiLFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwicG9zdGluc3RhbGxcIjogXCJub2RlIHNjcmlwdHMvY29weS1zdG9ja2Zpc2gubWpzXCIsXG4gICAgXCJwcmVidWlsZFwiOiBcIm5vZGUgc2NyaXB0cy9jb3B5LXN0b2NrZmlzaC5tanNcIixcbiAgICBcImRldlwiOiBcIm5vZGUgc2NyaXB0cy9jb3B5LXN0b2NrZmlzaC5tanMgJiYgdml0ZVwiLFxuICAgIFwiYnVpbGRcIjogXCJub2RlIHNjcmlwdHMvY29weS1zdG9ja2Zpc2gubWpzICYmIHRzYyAtLW5vRW1pdCAmJiB2aXRlIGJ1aWxkXCIsXG4gICAgXCJidWlsZDpub2NoZWNrXCI6IFwibm9kZSBzY3JpcHRzL2NvcHktc3RvY2tmaXNoLm1qcyAmJiB2aXRlIGJ1aWxkXCIsXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXG4gICAgXCJ0ZXN0XCI6IFwibm9kZSAtLWltcG9ydCB0c3ggLS10ZXN0IHRlc3QvZW5naW5lLnRlc3QudHNcIlxuICB9LFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGVzcy5qc1wiOiBcIl4xLjAuMC1iZXRhLjhcIixcbiAgICBcInJlYWN0XCI6IFwiXjE4LjMuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiLFxuICAgIFwic3RvY2tmaXNoXCI6IFwiXjE4LjAuOFwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjI4XCIsXG4gICAgXCJAdHlwZXMvY2hyb21lXCI6IFwiXjAuMC4yNzBcIixcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjIwLjE5LjQzXCIsXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMy4zXCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjMuMFwiLFxuICAgIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjogXCJeNC4zLjFcIixcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjE5XCIsXG4gICAgXCJwb3N0Y3NzXCI6IFwiXjguNC4zOVwiLFxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy40LjdcIixcbiAgICBcInRzeFwiOiBcIl40LjE2LjJcIixcbiAgICBcInR5cGVzY3JpcHRcIjogXCJeNS41LjRcIixcbiAgICBcInZpdGVcIjogXCJeNS40LjBcIlxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlULFNBQVMsb0JBQW9CO0FBQ3RWLE9BQU8sV0FBVztBQUNsQixTQUFTLFdBQVc7OztBQ0Z5VCxTQUFTLHNCQUFzQjs7O0FDQTVXO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxhQUFlO0FBQUEsRUFDZixNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsSUFDVCxhQUFlO0FBQUEsSUFDZixVQUFZO0FBQUEsSUFDWixLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxpQkFBaUI7QUFBQSxJQUNqQixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLFlBQVk7QUFBQSxJQUNaLE9BQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFdBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxpQkFBbUI7QUFBQSxJQUNqQixzQkFBc0I7QUFBQSxJQUN0QixpQkFBaUI7QUFBQSxJQUNqQixlQUFlO0FBQUEsSUFDZixnQkFBZ0I7QUFBQSxJQUNoQixvQkFBb0I7QUFBQSxJQUNwQix3QkFBd0I7QUFBQSxJQUN4QixjQUFnQjtBQUFBLElBQ2hCLFNBQVc7QUFBQSxJQUNYLGFBQWU7QUFBQSxJQUNmLEtBQU87QUFBQSxJQUNQLFlBQWM7QUFBQSxJQUNkLE1BQVE7QUFBQSxFQUNWO0FBQ0Y7OztBRC9CQSxJQUFPLDBCQUFRLGVBQWU7QUFBQSxFQUM1QixrQkFBa0I7QUFBQSxFQUNsQixNQUFNO0FBQUEsRUFDTixTQUFTLGdCQUFJO0FBQUEsRUFDYixhQUFhLGdCQUFJO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0wsSUFBSTtBQUFBLElBQ0osSUFBSTtBQUFBLElBQ0osS0FBSztBQUFBLEVBQ1A7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLGVBQWU7QUFBQSxJQUNmLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsY0FBYztBQUFBLEVBQ2QsWUFBWTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsSUFDaEIsTUFBTTtBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUEsRUFHQSx5QkFBeUI7QUFBQSxJQUN2QixpQkFBaUI7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsYUFBYSxDQUFDLFdBQVcsYUFBYSxhQUFhLFFBQVEsV0FBVztBQUFBLEVBQ3RFLGtCQUFrQjtBQUFBLElBQ2hCO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0EsaUJBQWlCO0FBQUEsSUFDZjtBQUFBLE1BQ0UsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksQ0FBQyx5QkFBeUI7QUFBQSxNQUM5QixRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFVBQVU7QUFBQSxJQUNSLGtCQUFrQjtBQUFBLE1BQ2hCLGVBQWUsRUFBRSxTQUFTLFFBQVE7QUFBQSxNQUNsQyxhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLDBCQUEwQjtBQUFBLElBQ3hCO0FBQUEsTUFDRSxXQUFXLENBQUMsWUFBWSxXQUFXLGVBQWUsOEJBQThCO0FBQUEsTUFDaEYsU0FBUyxDQUFDLFlBQVk7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFDRixDQUFDOzs7QUR4REQsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUUsa0NBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1QsV0FBVztBQUFBLFFBQ1gsV0FBVztBQUFBLE1BQ2I7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osS0FBSyxFQUFFLE1BQU0sS0FBSztBQUFBLEVBQ3BCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
