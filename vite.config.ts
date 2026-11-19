import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from /ecocypher/. On Vercel set BASE_PATH=/ .
export default defineConfig({
  base: process.env.BASE_PATH ?? "/ecocypher/",
  plugins: [react()],
  test: { environment: "jsdom" },
} as any);
