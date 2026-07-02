// vite.config.ts
import { defineConfig } from "file:///sessions/adoring-gallant-hopper/mnt/chesser/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/adoring-gallant-hopper/mnt/chesser/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///sessions/adoring-gallant-hopper/mnt/chesser/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// src/manifest.config.ts
import { defineManifest } from "file:///sessions/adoring-gallant-hopper/mnt/chesser/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "chess-ai-agent",
  version: "0.1.0",
  description: "Real-time chess board analysis, best-move suggestions and AI coaching as a Chrome extension. Phase 1 foundation + working demo.",
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
    "react-dom": "^18.3.1"
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
  name: "Chess AI Agent",
  version: package_default.version,
  description: package_default.description,
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png"
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Chess AI Agent"
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module"
  },
  permissions: ["storage", "activeTab", "scripting", "tabs"],
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
      description: "Toggle the Chess AI overlay"
    }
  },
  web_accessible_resources: [
    {
      resources: ["assets/*", "icons/*"],
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
        dashboard: "src/dashboard/index.html"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LmNvbmZpZy50cyIsICJwYWNrYWdlLmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvY2hlc3NlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LmNvbmZpZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBjcngoeyBtYW5pZmVzdCB9KV0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBwb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICAgICAgb3B0aW9uczogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICAgICAgICBkYXNoYm9hcmQ6ICdzcmMvZGFzaGJvYXJkL2luZGV4Lmh0bWwnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgaG1yOiB7IHBvcnQ6IDUxNzMgfSxcbiAgfSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvY2hlc3Nlci9zcmNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWdhbGxhbnQtaG9wcGVyL21udC9jaGVzc2VyL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvc3JjL21hbmlmZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxuLy8gTWFuaWZlc3QgVjMgY29uZmlndXJhdGlvbi4gU2VlIGJsdWVwcmludCBcdTAwQTc0IChDaHJvbWUgRXh0ZW5zaW9uIE1WMykgYW5kIFx1MDBBNzEyLlxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxuICBuYW1lOiAnQ2hlc3MgQUkgQWdlbnQnLFxuICB2ZXJzaW9uOiBwa2cudmVyc2lvbixcbiAgZGVzY3JpcHRpb246IHBrZy5kZXNjcmlwdGlvbixcbiAgaWNvbnM6IHtcbiAgICAxNjogJ2ljb25zL2ljb24xNi5wbmcnLFxuICAgIDQ4OiAnaWNvbnMvaWNvbjQ4LnBuZycsXG4gICAgMTI4OiAnaWNvbnMvaWNvbjEyOC5wbmcnLFxuICB9LFxuICBhY3Rpb246IHtcbiAgICBkZWZhdWx0X3BvcHVwOiAnc3JjL3BvcHVwL2luZGV4Lmh0bWwnLFxuICAgIGRlZmF1bHRfdGl0bGU6ICdDaGVzcyBBSSBBZ2VudCcsXG4gIH0sXG4gIG9wdGlvbnNfcGFnZTogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICBiYWNrZ3JvdW5kOiB7XG4gICAgc2VydmljZV93b3JrZXI6ICdzcmMvYmFja2dyb3VuZC9zZXJ2aWNlLXdvcmtlci50cycsXG4gICAgdHlwZTogJ21vZHVsZScsXG4gIH0sXG4gIHBlcm1pc3Npb25zOiBbJ3N0b3JhZ2UnLCAnYWN0aXZlVGFiJywgJ3NjcmlwdGluZycsICd0YWJzJ10sXG4gIGhvc3RfcGVybWlzc2lvbnM6IFtcbiAgICAnaHR0cHM6Ly93d3cuY2hlc3MuY29tLyonLFxuICAgICdodHRwczovL2xpY2hlc3Mub3JnLyonLFxuICAgICdodHRwczovL2NoZXNzMjQuY29tLyonLFxuICAgICdodHRwczovL2FwaS5hbnRocm9waWMuY29tLyonLFxuICAgICdodHRwOi8vbG9jYWxob3N0LyonLFxuICAgICdodHRwOi8vMTI3LjAuMC4xLyonLFxuICAgICdodHRwczovL2FwaS5jaGVzc2FpLmFwcC8qJyxcbiAgXSxcbiAgY29udGVudF9zY3JpcHRzOiBbXG4gICAge1xuICAgICAgbWF0Y2hlczogW1xuICAgICAgICAnaHR0cHM6Ly93d3cuY2hlc3MuY29tLyonLFxuICAgICAgICAnaHR0cHM6Ly9saWNoZXNzLm9yZy8qJyxcbiAgICAgICAgJ2h0dHBzOi8vY2hlc3MyNC5jb20vKicsXG4gICAgICBdLFxuICAgICAganM6IFsnc3JjL2NvbnRlbnQvY29udGVudC50c3gnXSxcbiAgICAgIHJ1bl9hdDogJ2RvY3VtZW50X2lkbGUnLFxuICAgIH0sXG4gIF0sXG4gIGNvbW1hbmRzOiB7XG4gICAgJ3RvZ2dsZS1vdmVybGF5Jzoge1xuICAgICAgc3VnZ2VzdGVkX2tleTogeyBkZWZhdWx0OiAnQWx0K0MnIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1RvZ2dsZSB0aGUgQ2hlc3MgQUkgb3ZlcmxheScsXG4gICAgfSxcbiAgfSxcbiAgd2ViX2FjY2Vzc2libGVfcmVzb3VyY2VzOiBbXG4gICAge1xuICAgICAgcmVzb3VyY2VzOiBbJ2Fzc2V0cy8qJywgJ2ljb25zLyonXSxcbiAgICAgIG1hdGNoZXM6IFsnPGFsbF91cmxzPiddLFxuICAgIH0sXG4gIF0sXG59KTtcbiIsICJ7XG4gIFwibmFtZVwiOiBcImNoZXNzLWFpLWFnZW50XCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMS4wXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJSZWFsLXRpbWUgY2hlc3MgYm9hcmQgYW5hbHlzaXMsIGJlc3QtbW92ZSBzdWdnZXN0aW9ucyBhbmQgQUkgY29hY2hpbmcgYXMgYSBDaHJvbWUgZXh0ZW5zaW9uLiBQaGFzZSAxIGZvdW5kYXRpb24gKyB3b3JraW5nIGRlbW8uXCIsXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxuICBcImxpY2Vuc2VcIjogXCJNSVRcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImRldlwiOiBcInZpdGVcIixcbiAgICBcImJ1aWxkXCI6IFwidHNjIC0tbm9FbWl0ICYmIHZpdGUgYnVpbGRcIixcbiAgICBcImJ1aWxkOm5vY2hlY2tcIjogXCJ2aXRlIGJ1aWxkXCIsXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXG4gICAgXCJ0ZXN0XCI6IFwibm9kZSAtLWltcG9ydCB0c3ggLS10ZXN0IHRlc3QvZW5naW5lLnRlc3QudHNcIlxuICB9LFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGVzcy5qc1wiOiBcIl4xLjAuMC1iZXRhLjhcIixcbiAgICBcInJlYWN0XCI6IFwiXjE4LjMuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjI4XCIsXG4gICAgXCJAdHlwZXMvY2hyb21lXCI6IFwiXjAuMC4yNzBcIixcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjIwLjE5LjQzXCIsXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMy4zXCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjMuMFwiLFxuICAgIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjogXCJeNC4zLjFcIixcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjE5XCIsXG4gICAgXCJwb3N0Y3NzXCI6IFwiXjguNC4zOVwiLFxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy40LjdcIixcbiAgICBcInRzeFwiOiBcIl40LjE2LjJcIixcbiAgICBcInR5cGVzY3JpcHRcIjogXCJeNS41LjRcIixcbiAgICBcInZpdGVcIjogXCJeNS40LjBcIlxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNULFNBQVMsb0JBQW9CO0FBQ25WLE9BQU8sV0FBVztBQUNsQixTQUFTLFdBQVc7OztBQ0ZzVCxTQUFTLHNCQUFzQjs7O0FDQXpXO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxhQUFlO0FBQUEsRUFDZixNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxpQkFBaUI7QUFBQSxJQUNqQixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLFlBQVk7QUFBQSxJQUNaLE9BQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxpQkFBbUI7QUFBQSxJQUNqQixzQkFBc0I7QUFBQSxJQUN0QixpQkFBaUI7QUFBQSxJQUNqQixlQUFlO0FBQUEsSUFDZixnQkFBZ0I7QUFBQSxJQUNoQixvQkFBb0I7QUFBQSxJQUNwQix3QkFBd0I7QUFBQSxJQUN4QixjQUFnQjtBQUFBLElBQ2hCLFNBQVc7QUFBQSxJQUNYLGFBQWU7QUFBQSxJQUNmLEtBQU87QUFBQSxJQUNQLFlBQWM7QUFBQSxJQUNkLE1BQVE7QUFBQSxFQUNWO0FBQ0Y7OztBRDVCQSxJQUFPLDBCQUFRLGVBQWU7QUFBQSxFQUM1QixrQkFBa0I7QUFBQSxFQUNsQixNQUFNO0FBQUEsRUFDTixTQUFTLGdCQUFJO0FBQUEsRUFDYixhQUFhLGdCQUFJO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0wsSUFBSTtBQUFBLElBQ0osSUFBSTtBQUFBLElBQ0osS0FBSztBQUFBLEVBQ1A7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLGVBQWU7QUFBQSxJQUNmLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsY0FBYztBQUFBLEVBQ2QsWUFBWTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsSUFDaEIsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLGFBQWEsQ0FBQyxXQUFXLGFBQWEsYUFBYSxNQUFNO0FBQUEsRUFDekQsa0JBQWtCO0FBQUEsSUFDaEI7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxpQkFBaUI7QUFBQSxJQUNmO0FBQUEsTUFDRSxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsSUFBSSxDQUFDLHlCQUF5QjtBQUFBLE1BQzlCLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsVUFBVTtBQUFBLElBQ1Isa0JBQWtCO0FBQUEsTUFDaEIsZUFBZSxFQUFFLFNBQVMsUUFBUTtBQUFBLE1BQ2xDLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0EsMEJBQTBCO0FBQUEsSUFDeEI7QUFBQSxNQUNFLFdBQVcsQ0FBQyxZQUFZLFNBQVM7QUFBQSxNQUNqQyxTQUFTLENBQUMsWUFBWTtBQUFBLElBQ3hCO0FBQUEsRUFDRjtBQUNGLENBQUM7OztBRG5ERCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRSxrQ0FBUyxDQUFDLENBQUM7QUFBQSxFQUNwQyxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsUUFDTCxPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsUUFDVCxXQUFXO0FBQUEsTUFDYjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixLQUFLLEVBQUUsTUFBTSxLQUFLO0FBQUEsRUFDcEI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
