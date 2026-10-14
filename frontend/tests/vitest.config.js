import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// End-to-end tests: real pages -> the real API -> a test PostgreSQL database.
// See tests/README.md for what has to be running first.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.jsx"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
