import { defineConfig } from 'vite'
import cdn from 'vite-plugin-cdn-import'
import react from '@vitejs/plugin-react'
import type { Plugin } from "vite"
import path from 'path'

interface SourcemapExclude {
    excludeNodeModules?: boolean;
}
export function sourcemapExclude(opts?: SourcemapExclude): Plugin {
    return {
        name: "sourcemap-exclude",
        transform(code: string, id: string) {
            if (opts?.excludeNodeModules && id.includes("node_modules")) {
                return {
                    code,
                    // https://github.com/rollup/rollup/blob/master/docs/plugin-development/index.md#source-code-transformations
                    map: { mappings: "" },
                };
            }
        },
    };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/node_modules/**']
    }
  },
  plugins: [
    react(),
    cdn({
      modules: ['react', 'react-dom'],
    }),
    sourcemapExclude({ excludeNodeModules: true }),
  ],
  build: {
    sourcemap: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  }
})
