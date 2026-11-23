import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Content Security Policy for the built site: scripts only from this site, no inline scripts,
// no connections to other servers. Added at build time only (the dev server needs inline scripts).
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the in-browser Python (WebAssembly) start; it does not allow eval() of JS.
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const csp = (): Plugin => ({
  name: "csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace("<meta charset=\"UTF-8\" />", `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// GitHub Pages serves the site from /ecocypher/. On Vercel set BASE_PATH=/ .
export default defineConfig({
  base: process.env.BASE_PATH ?? "/ecocypher/",
  plugins: [react(), csp()],
  build: { sourcemap: false },
  // The Python worker loads Pyodide with a dynamic import, which needs ES-module workers.
  worker: { format: "es" },
  // With `npm run api:dev` running, /api calls go to the local server (dev and preview).
  server: { proxy: { "/api": "http://localhost:8787" } },
  preview: { proxy: { "/api": "http://localhost:8787" } },
  test: { environment: "node" },
} as any);
