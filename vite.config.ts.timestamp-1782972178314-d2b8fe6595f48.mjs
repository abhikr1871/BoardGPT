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
    "https://chess24.com/*"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LmNvbmZpZy50cyIsICJwYWNrYWdlLmpzb24iXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvY2hlc3NlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LmNvbmZpZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBjcngoeyBtYW5pZmVzdCB9KV0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBwb3B1cDogJ3NyYy9wb3B1cC9pbmRleC5odG1sJyxcbiAgICAgICAgb3B0aW9uczogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICAgICAgICBkYXNoYm9hcmQ6ICdzcmMvZGFzaGJvYXJkL2luZGV4Lmh0bWwnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgaG1yOiB7IHBvcnQ6IDUxNzMgfSxcbiAgfSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvYWRvcmluZy1nYWxsYW50LWhvcHBlci9tbnQvY2hlc3Nlci9zcmNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9hZG9yaW5nLWdhbGxhbnQtaG9wcGVyL21udC9jaGVzc2VyL3NyYy9tYW5pZmVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2Fkb3JpbmctZ2FsbGFudC1ob3BwZXIvbW50L2NoZXNzZXIvc3JjL21hbmlmZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxuLy8gTWFuaWZlc3QgVjMgY29uZmlndXJhdGlvbi4gU2VlIGJsdWVwcmludCBcdTAwQTc0IChDaHJvbWUgRXh0ZW5zaW9uIE1WMykgYW5kIFx1MDBBNzEyLlxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxuICBuYW1lOiAnQ2hlc3MgQUkgQWdlbnQnLFxuICB2ZXJzaW9uOiBwa2cudmVyc2lvbixcbiAgZGVzY3JpcHRpb246IHBrZy5kZXNjcmlwdGlvbixcbiAgaWNvbnM6IHtcbiAgICAxNjogJ2ljb25zL2ljb24xNi5wbmcnLFxuICAgIDQ4OiAnaWNvbnMvaWNvbjQ4LnBuZycsXG4gICAgMTI4OiAnaWNvbnMvaWNvbjEyOC5wbmcnLFxuICB9LFxuICBhY3Rpb246IHtcbiAgICBkZWZhdWx0X3BvcHVwOiAnc3JjL3BvcHVwL2luZGV4Lmh0bWwnLFxuICAgIGRlZmF1bHRfdGl0bGU6ICdDaGVzcyBBSSBBZ2VudCcsXG4gIH0sXG4gIG9wdGlvbnNfcGFnZTogJ3NyYy9vcHRpb25zL2luZGV4Lmh0bWwnLFxuICBiYWNrZ3JvdW5kOiB7XG4gICAgc2VydmljZV93b3JrZXI6ICdzcmMvYmFja2dyb3VuZC9zZXJ2aWNlLXdvcmtlci50cycsXG4gICAgdHlwZTogJ21vZHVsZScsXG4gIH0sXG4gIHBlcm1pc3Npb25zOiBbJ3N0b3JhZ2UnLCAnYWN0aXZlVGFiJywgJ3NjcmlwdGluZycsICd0YWJzJ10sXG4gIGhvc3RfcGVybWlzc2lvbnM6IFtcbiAgICAnaHR0cHM6Ly93d3cuY2hlc3MuY29tLyonLFxuICAgICdodHRwczovL2xpY2hlc3Mub3JnLyonLFxuICAgICdodHRwczovL2NoZXNzMjQuY29tLyonLFxuICBdLFxuICBjb250ZW50X3NjcmlwdHM6IFtcbiAgICB7XG4gICAgICBtYXRjaGVzOiBbXG4gICAgICAgICdodHRwczovL3d3dy5jaGVzcy5jb20vKicsXG4gICAgICAgICdodHRwczovL2xpY2hlc3Mub3JnLyonLFxuICAgICAgICAnaHR0cHM6Ly9jaGVzczI0LmNvbS8qJyxcbiAgICAgIF0sXG4gICAgICBqczogWydzcmMvY29udGVudC9jb250ZW50LnRzeCddLFxuICAgICAgcnVuX2F0OiAnZG9jdW1lbnRfaWRsZScsXG4gICAgfSxcbiAgXSxcbiAgY29tbWFuZHM6IHtcbiAgICAndG9nZ2xlLW92ZXJsYXknOiB7XG4gICAgICBzdWdnZXN0ZWRfa2V5OiB7IGRlZmF1bHQ6ICdBbHQrQycgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVG9nZ2xlIHRoZSBDaGVzcyBBSSBvdmVybGF5JyxcbiAgICB9LFxuICB9LFxuICB3ZWJfYWNjZXNzaWJsZV9yZXNvdXJjZXM6IFtcbiAgICB7XG4gICAgICByZXNvdXJjZXM6IFsnYXNzZXRzLyonLCAnaWNvbnMvKiddLFxuICAgICAgbWF0Y2hlczogWyc8YWxsX3VybHM+J10sXG4gICAgfSxcbiAgXSxcbn0pO1xuIiwgIntcbiAgXCJuYW1lXCI6IFwiY2hlc3MtYWktYWdlbnRcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4xLjBcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIlJlYWwtdGltZSBjaGVzcyBib2FyZCBhbmFseXNpcywgYmVzdC1tb3ZlIHN1Z2dlc3Rpb25zIGFuZCBBSSBjb2FjaGluZyBhcyBhIENocm9tZSBleHRlbnNpb24uIFBoYXNlIDEgZm91bmRhdGlvbiArIHdvcmtpbmcgZGVtby5cIixcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXG4gIFwibGljZW5zZVwiOiBcIk1JVFwiLFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwiZGV2XCI6IFwidml0ZVwiLFxuICAgIFwiYnVpbGRcIjogXCJ0c2MgLS1ub0VtaXQgJiYgdml0ZSBidWlsZFwiLFxuICAgIFwiYnVpbGQ6bm9jaGVja1wiOiBcInZpdGUgYnVpbGRcIixcbiAgICBcInByZXZpZXdcIjogXCJ2aXRlIHByZXZpZXdcIixcbiAgICBcInRlc3RcIjogXCJub2RlIC0taW1wb3J0IHRzeCAtLXRlc3QgdGVzdC9lbmdpbmUudGVzdC50c1wiXG4gIH0sXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImNoZXNzLmpzXCI6IFwiXjEuMC4wLWJldGEuOFwiLFxuICAgIFwicmVhY3RcIjogXCJeMTguMy4xXCIsXG4gICAgXCJyZWFjdC1kb21cIjogXCJeMTguMy4xXCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI6IFwiXjIuMC4wLWJldGEuMjhcIixcbiAgICBcIkB0eXBlcy9jaHJvbWVcIjogXCJeMC4wLjI3MFwiLFxuICAgIFwiQHR5cGVzL25vZGVcIjogXCJeMjAuMTkuNDNcIixcbiAgICBcIkB0eXBlcy9yZWFjdFwiOiBcIl4xOC4zLjNcIixcbiAgICBcIkB0eXBlcy9yZWFjdC1kb21cIjogXCJeMTguMy4wXCIsXG4gICAgXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiOiBcIl40LjMuMVwiLFxuICAgIFwiYXV0b3ByZWZpeGVyXCI6IFwiXjEwLjQuMTlcIixcbiAgICBcInBvc3Rjc3NcIjogXCJeOC40LjM5XCIsXG4gICAgXCJ0YWlsd2luZGNzc1wiOiBcIl4zLjQuN1wiLFxuICAgIFwidHN4XCI6IFwiXjQuMTYuMlwiLFxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjUuNFwiLFxuICAgIFwidml0ZVwiOiBcIl41LjQuMFwiXG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1QsU0FBUyxvQkFBb0I7QUFDblYsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsV0FBVzs7O0FDRnNULFNBQVMsc0JBQXNCOzs7QUNBelc7QUFBQSxFQUNFLE1BQVE7QUFBQSxFQUNSLFNBQVc7QUFBQSxFQUNYLGFBQWU7QUFBQSxFQUNmLE1BQVE7QUFBQSxFQUNSLFNBQVc7QUFBQSxFQUNYLFNBQVc7QUFBQSxJQUNULEtBQU87QUFBQSxJQUNQLE9BQVM7QUFBQSxJQUNULGlCQUFpQjtBQUFBLElBQ2pCLFNBQVc7QUFBQSxJQUNYLE1BQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxjQUFnQjtBQUFBLElBQ2QsWUFBWTtBQUFBLElBQ1osT0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLGlCQUFtQjtBQUFBLElBQ2pCLHNCQUFzQjtBQUFBLElBQ3RCLGlCQUFpQjtBQUFBLElBQ2pCLGVBQWU7QUFBQSxJQUNmLGdCQUFnQjtBQUFBLElBQ2hCLG9CQUFvQjtBQUFBLElBQ3BCLHdCQUF3QjtBQUFBLElBQ3hCLGNBQWdCO0FBQUEsSUFDaEIsU0FBVztBQUFBLElBQ1gsYUFBZTtBQUFBLElBQ2YsS0FBTztBQUFBLElBQ1AsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLEVBQ1Y7QUFDRjs7O0FENUJBLElBQU8sMEJBQVEsZUFBZTtBQUFBLEVBQzVCLGtCQUFrQjtBQUFBLEVBQ2xCLE1BQU07QUFBQSxFQUNOLFNBQVMsZ0JBQUk7QUFBQSxFQUNiLGFBQWEsZ0JBQUk7QUFBQSxFQUNqQixPQUFPO0FBQUEsSUFDTCxJQUFJO0FBQUEsSUFDSixJQUFJO0FBQUEsSUFDSixLQUFLO0FBQUEsRUFDUDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sZUFBZTtBQUFBLElBQ2YsZUFBZTtBQUFBLEVBQ2pCO0FBQUEsRUFDQSxjQUFjO0FBQUEsRUFDZCxZQUFZO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsYUFBYSxDQUFDLFdBQVcsYUFBYSxhQUFhLE1BQU07QUFBQSxFQUN6RCxrQkFBa0I7QUFBQSxJQUNoQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0EsaUJBQWlCO0FBQUEsSUFDZjtBQUFBLE1BQ0UsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksQ0FBQyx5QkFBeUI7QUFBQSxNQUM5QixRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFVBQVU7QUFBQSxJQUNSLGtCQUFrQjtBQUFBLE1BQ2hCLGVBQWUsRUFBRSxTQUFTLFFBQVE7QUFBQSxNQUNsQyxhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLDBCQUEwQjtBQUFBLElBQ3hCO0FBQUEsTUFDRSxXQUFXLENBQUMsWUFBWSxTQUFTO0FBQUEsTUFDakMsU0FBUyxDQUFDLFlBQVk7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFDRixDQUFDOzs7QUQvQ0QsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxJQUFJLEVBQUUsa0NBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1QsV0FBVztBQUFBLE1BQ2I7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osS0FBSyxFQUFFLE1BQU0sS0FBSztBQUFBLEVBQ3BCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
