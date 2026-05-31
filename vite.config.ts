/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. No env vars, no server. Everything (PDF text + OCR) runs in the browser.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  test: {
    // parseReceipt is pure — runs in a plain node environment, no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
