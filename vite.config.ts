/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA + Vercel serverless functions in api/ (extraction, 889 search, US Bank
// proxy). Client-side extraction (PDF text + OCR) runs in the browser.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  test: {
    // parseReceipt is pure — runs in a plain node environment, no DOM needed.
    // api/ covers the serverless Textract mapping (pure functions only).
    environment: "node",
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
