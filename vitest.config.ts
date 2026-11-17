import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import react from "@vitejs/plugin-react";
import { chromaticPlugin } from "@chromatic-com/vitest/plugin";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}", "functions/src/**/*.test.ts"],
          exclude: ["src/**/*.visual.test.tsx"],
          // @uiw/react-markdown-preview imports .css from its ESM build; inline it so
          // Vite handles the CSS instead of Node's loader.
          server: { deps: { inline: [/@uiw\//] } },
        },
      },
      {
        // Visual regression tests: rendered in real Chromium and captured by Chromatic.
        extends: true,
        // Snapshots are explicit (takeSnapshot): the automatic one fires after
        // afterEach cleanup, when the component is already unmounted.
        plugins: [chromaticPlugin({ disableAutoSnapshot: true })],
        test: {
          name: "visual",
          include: ["src/**/*.visual.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify("test"),
  },
});
