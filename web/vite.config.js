import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The provably-fair core (../shared) is imported directly by the in-browser
// verifier so the player runs the exact same code the house ran.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "../shared") },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)] },
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/chain": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
