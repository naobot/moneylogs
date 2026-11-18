// Walkthroughs of the user flows in docs/user-states.md, in a real browser against the
// emulators. Run with `npm run e2e` (emulators up first); not part of `vp test`.
import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    name: "e2e",
    root: path.resolve(import.meta.dirname, ".."),
    include: ["e2e/**/*.e2e.ts"],
    environment: "node",
    globalSetup: ["e2e/support/globalSetup.ts"],
    // One browser flow at a time: they share the emulator data.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../src") },
  },
});
