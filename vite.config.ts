import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Reduce memory usage by splitting into smaller chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-turf': ['@turf/turf'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
    // Use esbuild for minification (faster and less memory than terser)
    minify: 'esbuild',
    // Disable source maps in production to save memory
    sourcemap: false,
  },
});
