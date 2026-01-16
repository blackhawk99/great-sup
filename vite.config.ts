import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Skip gzip size calculation to save memory
    reportCompressedSize: false,
    // Reduce memory usage by splitting into smaller chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-turf': ['@turf/turf'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-map': ['leaflet', 'react-leaflet'],
        },
      },
    },
    // Disable minification to reduce memory usage during build
    minify: false,
    // Disable source maps in production to save memory
    sourcemap: false,
    // Suppress chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
});
