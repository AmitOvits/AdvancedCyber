import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyRes", (proxyRes) => {
            const expose = proxyRes.headers["access-control-expose-headers"];
            const ours = "x-training-vulnerability";
            if (!expose || String(expose).split(",").every((h) => h.trim().toLowerCase() !== ours)) {
              proxyRes.headers["access-control-expose-headers"] = expose
                ? `${expose}, ${ours}`
                : ours;
            }
          });
        },
      },
      "/ftp": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyRes", (proxyRes) => {
            const expose = proxyRes.headers["access-control-expose-headers"];
            const ours = "x-training-vulnerability";
            if (!expose || String(expose).split(",").every((h) => h.trim().toLowerCase() !== ours)) {
              proxyRes.headers["access-control-expose-headers"] = expose
                ? `${expose}, ${ours}`
                : ours;
            }
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
