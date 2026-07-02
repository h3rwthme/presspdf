import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' => jalan di GitHub Pages (subpath) maupun file:// (Tauri/Electron)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          pdflib: ['pdf-lib'],
          vendor: ['react', 'react-dom', 'jszip'],
        },
      },
    },
  },
})
