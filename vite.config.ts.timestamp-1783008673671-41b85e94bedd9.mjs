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
    dev: "vite",
    build: "tsc --noEmit && vite build",
    "build:nocheck": "vite build",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LmNvbmZpZy50cyIsICJwYWNrYWdlLmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvQm9hcmRHUFRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWdhbGxhbnQtaG9wcGVyL21udC9Cb2FyZEdQVC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvQm9hcmRHUFQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LmNvbmZpZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBjcngoeyBtYW5pZmVzdCB9KV0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBwb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICAgICAgb3B0aW9uczogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICAgICAgICBkYXNoYm9hcmQ6ICdzcmMvZGFzaGJvYXJkL2luZGV4Lmh0bWwnLFxuICAgICAgICBvZmZzY3JlZW46ICdzcmMvb2Zmc2NyZWVuL29mZnNjcmVlbi5odG1sJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhtcjogeyBwb3J0OiA1MTczIH0sXG4gIH0sXG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyY1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L0JvYXJkR1BUL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVNYW5pZmVzdCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbi8vIE1hbmlmZXN0IFYzIGNvbmZpZ3VyYXRpb24uIFNlZSBibHVlcHJpbnQgXHUwMEE3NCAoQ2hyb21lIEV4dGVuc2lvbiBNVjMpIGFuZCBcdTAwQTcxMi5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZU1hbmlmZXN0KHtcbiAgbWFuaWZlc3RfdmVyc2lvbjogMyxcbiAgbmFtZTogJ0JvYXJkR1BUJyxcbiAgdmVyc2lvbjogcGtnLnZlcnNpb24sXG4gIGRlc2NyaXB0aW9uOiBwa2cuZGVzY3JpcHRpb24sXG4gIGljb25zOiB7XG4gICAgMTY6ICdpY29ucy9pY29uMTYucG5nJyxcbiAgICA0ODogJ2ljb25zL2ljb240OC5wbmcnLFxuICAgIDEyODogJ2ljb25zL2ljb24xMjgucG5nJyxcbiAgfSxcbiAgYWN0aW9uOiB7XG4gICAgZGVmYXVsdF9wb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICBkZWZhdWx0X3RpdGxlOiAnQm9hcmRHUFQnLFxuICB9LFxuICBvcHRpb25zX3BhZ2U6ICdzcmMvb3B0aW9ucy9pbmRleC5odG1sJyxcbiAgYmFja2dyb3VuZDoge1xuICAgIHNlcnZpY2Vfd29ya2VyOiAnc3JjL2JhY2tncm91bmQvc2VydmljZS13b3JrZXIudHMnLFxuICAgIHR5cGU6ICdtb2R1bGUnLFxuICB9LFxuICBwZXJtaXNzaW9uczogWydzdG9yYWdlJywgJ2FjdGl2ZVRhYicsICdzY3JpcHRpbmcnLCAndGFicycsICdvZmZzY3JlZW4nXSxcbiAgaG9zdF9wZXJtaXNzaW9uczogW1xuICAgICdodHRwczovL3d3dy5jaGVzcy5jb20vKicsXG4gICAgJ2h0dHBzOi8vbGljaGVzcy5vcmcvKicsXG4gICAgJ2h0dHBzOi8vY2hlc3MyNC5jb20vKicsXG4gICAgJ2h0dHBzOi8vYXBpLmFudGhyb3BpYy5jb20vKicsXG4gICAgJ2h0dHA6Ly9sb2NhbGhvc3QvKicsXG4gICAgJ2h0dHA6Ly8xMjcuMC4wLjEvKicsXG4gICAgJ2h0dHBzOi8vYXBpLmNoZXNzYWkuYXBwLyonLFxuICBdLFxuICBjb250ZW50X3NjcmlwdHM6IFtcbiAgICB7XG4gICAgICBtYXRjaGVzOiBbXG4gICAgICAgICdodHRwczovL3d3dy5jaGVzcy5jb20vKicsXG4gICAgICAgICdodHRwczovL2xpY2hlc3Mub3JnLyonLFxuICAgICAgICAnaHR0cHM6Ly9jaGVzczI0LmNvbS8qJyxcbiAgICAgIF0sXG4gICAgICBqczogWydzcmMvY29udGVudC9jb250ZW50LnRzeCddLFxuICAgICAgcnVuX2F0OiAnZG9jdW1lbnRfaWRsZScsXG4gICAgfSxcbiAgXSxcbiAgY29tbWFuZHM6IHtcbiAgICAndG9nZ2xlLW92ZXJsYXknOiB7XG4gICAgICBzdWdnZXN0ZWRfa2V5OiB7IGRlZmF1bHQ6ICdBbHQrQycgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVG9nZ2xlIHRoZSBCb2FyZEdQVCBvdmVybGF5JyxcbiAgICB9LFxuICB9LFxuICB3ZWJfYWNjZXNzaWJsZV9yZXNvdXJjZXM6IFtcbiAgICB7XG4gICAgICByZXNvdXJjZXM6IFsnYXNzZXRzLyonLCAnaWNvbnMvKicsICdzdG9ja2Zpc2gvKicsICdzcmMvb2Zmc2NyZWVuL29mZnNjcmVlbi5odG1sJ10sXG4gICAgICBtYXRjaGVzOiBbJzxhbGxfdXJscz4nXSxcbiAgICB9LFxuICBdLFxufSk7XG4iLCAie1xuICBcIm5hbWVcIjogXCJib2FyZGdwdFwiLFxuICBcInZlcnNpb25cIjogXCIwLjEuMFwiLFxuICBcImRlc2NyaXB0aW9uXCI6IFwiUmVhbC10aW1lIGNoZXNzIGJvYXJkIGFuYWx5c2lzLCBiZXN0LW1vdmUgc3VnZ2VzdGlvbnMgYW5kIEFJIGNvYWNoaW5nIGFzIGEgQ2hyb21lIGV4dGVuc2lvbiBcdTIwMTQgQm9hcmRHUFQuXCIsXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxuICBcImxpY2Vuc2VcIjogXCJNSVRcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImRldlwiOiBcInZpdGVcIixcbiAgICBcImJ1aWxkXCI6IFwidHNjIC0tbm9FbWl0ICYmIHZpdGUgYnVpbGRcIixcbiAgICBcImJ1aWxkOm5vY2hlY2tcIjogXCJ2aXRlIGJ1aWxkXCIsXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXG4gICAgXCJ0ZXN0XCI6IFwibm9kZSAtLWltcG9ydCB0c3ggLS10ZXN0IHRlc3QvZW5naW5lLnRlc3QudHNcIlxuICB9LFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGVzcy5qc1wiOiBcIl4xLjAuMC1iZXRhLjhcIixcbiAgICBcInJlYWN0XCI6IFwiXjE4LjMuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiLFxuICAgIFwic3RvY2tmaXNoXCI6IFwiXjE4LjAuOFwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjI4XCIsXG4gICAgXCJAdHlwZXMvY2hyb21lXCI6IFwiXjAuMC4yNzBcIixcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjIwLjE5LjQzXCIsXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMy4zXCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjMuMFwiLFxuICAgIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjogXCJeNC4zLjFcIixcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjE5XCIsXG4gICAgXCJwb3N0Y3NzXCI6IFwiXjguNC4zOVwiLFxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy40LjdcIixcbiAgICBcInRzeFwiOiBcIl40LjE2LjJcIixcbiAgICBcInR5cGVzY3JpcHRcIjogXCJeNS41LjRcIixcbiAgICBcInZpdGVcIjogXCJeNS40LjBcIlxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlULFNBQVMsb0JBQW9CO0FBQ3RWLE9BQU8sV0FBVztBQUNsQixTQUFTLFdBQVc7OztBQ0Z5VCxTQUFTLHNCQUFzQjs7O0FDQTVXO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxhQUFlO0FBQUEsRUFDZixNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxpQkFBaUI7QUFBQSxJQUNqQixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLFlBQVk7QUFBQSxJQUNaLE9BQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFdBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxpQkFBbUI7QUFBQSxJQUNqQixzQkFBc0I7QUFBQSxJQUN0QixpQkFBaUI7QUFBQSxJQUNqQixlQUFlO0FBQUEsSUFDZixnQkFBZ0I7QUFBQSxJQUNoQixvQkFBb0I7QUFBQSxJQUNwQix3QkFBd0I7QUFBQSxJQUN4QixjQUFnQjtBQUFBLElBQ2hCLFNBQVc7QUFBQSxJQUNYLGFBQWU7QUFBQSxJQUNmLEtBQU87QUFBQSxJQUNQLFlBQWM7QUFBQSxJQUNkLE1BQVE7QUFBQSxFQUNWO0FBQ0Y7OztBRDdCQSxJQUFPLDBCQUFRLGVBQWU7QUFBQSxFQUM1QixrQkFBa0I7QUFBQSxFQUNsQixNQUFNO0FBQUEsRUFDTixTQUFTLGdCQUFJO0FBQUEsRUFDYixhQUFhLGdCQUFJO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0wsSUFBSTtBQUFBLElBQ0osSUFBSTtBQUFBLElBQ0osS0FBSztBQUFBLEVBQ1A7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLGVBQWU7QUFBQSxJQUNmLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsY0FBYztBQUFBLEVBQ2QsWUFBWTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsSUFDaEIsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLGFBQWEsQ0FBQyxXQUFXLGFBQWEsYUFBYSxRQUFRLFdBQVc7QUFBQSxFQUN0RSxrQkFBa0I7QUFBQSxJQUNoQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGlCQUFpQjtBQUFBLElBQ2Y7QUFBQSxNQUNFLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxJQUFJLENBQUMseUJBQXlCO0FBQUEsTUFDOUIsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxVQUFVO0FBQUEsSUFDUixrQkFBa0I7QUFBQSxNQUNoQixlQUFlLEVBQUUsU0FBUyxRQUFRO0FBQUEsTUFDbEMsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQSwwQkFBMEI7QUFBQSxJQUN4QjtBQUFBLE1BQ0UsV0FBVyxDQUFDLFlBQVksV0FBVyxlQUFlLDhCQUE4QjtBQUFBLE1BQ2hGLFNBQVMsQ0FBQyxZQUFZO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzs7O0FEbkRELElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFLGtDQUFTLENBQUMsQ0FBQztBQUFBLEVBQ3BDLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE9BQU87QUFBQSxRQUNQLFNBQVM7QUFBQSxRQUNULFdBQVc7QUFBQSxRQUNYLFdBQVc7QUFBQSxNQUNiO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLEtBQUssRUFBRSxNQUFNLEtBQUs7QUFBQSxFQUNwQjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
