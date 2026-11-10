import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "functions/src/**/*.test.ts"],
    // @uiw/react-markdown-preview imports .css from its ESM build; inline it so
    // Vite handles the CSS instead of Node's loader.
    server: { deps: { inline: [/@uiw\//] } },
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
